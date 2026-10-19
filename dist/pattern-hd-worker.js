import {upscalePattern} from './pattern-hd-core.js';
self.onmessage=event=>{try{const result=upscalePattern(event.data.source,event.data.options,value=>self.postMessage({progress:value}));self.postMessage({result},[result.data.buffer]);}catch(error){self.postMessage({error:error.message});}};
