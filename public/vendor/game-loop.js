// Adapted from Pixel Agents (MIT). See third-party/UPSTREAM.json and LICENSE.
const MAX_DELTA_TIME_SEC = 0.1;

/** @internal */
                                    
                               
                                                  
 

/** @internal */
                           
                   
                                                                         
                                                                      
                     
 

export function startGameLoop(canvas                   , callbacks                   )           {
  const ctx = canvas.getContext('2d') ;
  ctx.imageSmoothingEnabled = false;

  let lastTime = 0;
  let rafId = 0;
  let stopped = false;

  const frame = (time        ) => {
    if (stopped) return;
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DELTA_TIME_SEC);
    lastTime = time;

    callbacks.update(dt);

    ctx.imageSmoothingEnabled = false;
    callbacks.render(ctx);

    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    },
    redraw: () => {
      if (stopped) return;
      ctx.imageSmoothingEnabled = false;
      callbacks.render(ctx);
    },
  };
}

