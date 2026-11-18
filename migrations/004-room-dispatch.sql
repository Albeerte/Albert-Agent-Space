CREATE INDEX tasks_room_channel
  ON tasks(json_extract(config,'$.roomChannel'), created_at DESC)
  WHERE json_extract(config,'$.roomChannel') IS NOT NULL;
CREATE UNIQUE INDEX tasks_dispatch_request
  ON tasks(json_extract(config,'$.dispatchRequest'))
  WHERE json_extract(config,'$.dispatchRequest') IS NOT NULL;
