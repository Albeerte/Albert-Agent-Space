"""Local HTTP adapter for a single installed agent SDK. Run each in its own venv."""
import asyncio
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore


async def generate(engine, model, prompt, base, key):
    rule = "You are an AI Agent Office specialist. Answer the user's task in Uzbek."
    if engine == "ag2":
        from ag2 import Agent
        from ag2.config import OpenAICompletionsConfig
        config = OpenAICompletionsConfig(model=model, api_key=key, base_url=base)
        reply = await Agent("office", prompt=rule, config=config).ask(prompt)
        return reply.body
    if engine == "autogen":
        from autogen_agentchat.agents import AssistantAgent
        from autogen_ext.models.openai import OpenAIChatCompletionClient
        client = OpenAIChatCompletionClient(
            model=model, base_url=base, api_key=key,
            model_info=dict(vision=False, function_calling=False, json_output=False,
                            structured_output=False, family="unknown"),
        )
        try:
            reply = await AssistantAgent("office", model_client=client, system_message=rule).run(task=prompt)
            return reply.messages[-1].content
        finally:
            await client.close()
    if engine == "crewai":
        from crewai import Agent, Crew, Task, LLM
        agent = Agent(role="Office specialist", goal=rule, backstory="Office team member",
                      llm=LLM(model="openai/"+model, base_url=base, api_key=key),
                      allow_delegation=False, max_iter=2)
        task = Task(description=prompt, expected_output="A concise answer in Uzbek.", agent=agent)
        reply = await Crew(agents=[agent], tasks=[task]).kickoff_async()
        return reply.raw
    if engine == "metagpt":
        from metagpt.configs.llm_config import LLMConfig
        from metagpt.llm import LLM
        llm = LLM(LLMConfig(model=model, api_key=key, base_url=base))
        return await llm.aask(prompt, system_msgs=[rule], stream=False)
    if engine == "swarms":
        from swarms import Agent
        agent = Agent(agent_name="Office", system_prompt=rule, model_name="openai/"+model,
                      llm_base_url=base, llm_api_key=key, max_loops=1, interactive=False)
        return agent.run(prompt)
    if engine == "google-adk":
        from google.adk.agents import Agent
        from google.adk.models.lite_llm import LiteLlm
        from google.adk.runners import InMemoryRunner
        llm = LiteLlm(model="openai/"+model, api_base=base, api_key=key)
        runner = InMemoryRunner(agent=Agent(name="office", model=llm, instruction=rule))
        try:
            events = await runner.run_debug(prompt, quiet=True)
            return "\n".join(part.text for event in events if event.is_final_response()
                             and event.content for part in event.content.parts if part.text)
        finally:
            await runner.close()
    raise ValueError("Unknown engine")


def main():
    engine = os.environ["OFFICE_WORKER_ENGINE"]
    model = os.environ["OFFICE_WORKER_MODEL"]
    base = os.environ["OFFICE_WORKER_MODEL_URL"]
    token = os.environ["OFFICE_WORKER_TOKEN"]
    if len(token) < 24:
        raise SystemExit("OFFICE_WORKER_TOKEN needs at least 24 characters.")
    key = os.environ.get("OFFICE_WORKER_MODEL_KEY", "local")
    slot = BoundedSemaphore(1)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/healthz":
                return self.response(404, {})
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer "+token):
                return self.response(401, {})
            self.response(200, {"engine": engine, "instance": os.environ.get("OFFICE_WORKER_INSTANCE")})

        def response(self, status, data):
            body = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != "/run":
                return self.response(404, {})
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer "+token):
                return self.response(401, {})
            length = self.headers.get("Content-Length", "")
            if not length.isdecimal() or not 0 < int(length) <= 400000:
                return self.response(413, {})
            try:
                body = json.loads(self.rfile.read(int(length)))
                if (not isinstance(body, dict) or body.get("engine") != engine or body.get("model") != model
                        or not isinstance(body.get("input"), str) or not body["input"].strip()):
                    return self.response(400, {"error": "Engine, model or input mismatch"})
            except (ValueError, UnicodeError):
                return self.response(400, {})
            if not slot.acquire(blocking=False):
                return self.response(429, {"error": "Worker busy"})
            try:
                output = asyncio.run(generate(engine, model, body["input"], base, key))
                if not isinstance(output, str) or not output.strip():
                    raise ValueError("Empty SDK answer")
                self.response(200, {"text": output})
            except Exception as exc:
                print("SDK error:", type(exc).__name__, file=sys.stderr, flush=True)
                self.response(502, {"error": "SDK or model call failed"})
            finally:
                slot.release()

    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("OFFICE_WORKER_PORT", "8910"))), Handler)
    print(engine, "worker on", server.server_address, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
