// A small connected DOM fixture: detached nodes cannot be found by document ID.
// This models the regression caused by moving the work area during initialization.
export function createTestDocument(markup){
  const elements=new Map(),voidTags=new Set(['meta','link','input','img','br','hr','source','wbr']);
  class Node{
    constructor(tag=null,text=''){this.tagName=tag;this.nodeType=tag?1:3;this.value='';this.data=text;this.childNodes=[];this.parentNode=null;this.attributes={};this.style={};this.dataset={};this.listeners={};this.hidden=false;this.disabled=false;}
    get id(){return this.attributes.id;}set id(value){this.attributes.id=value;elements.set(value,this);}
    get className(){return this.attributes.class||'';}set className(value){this.attributes.class=value;}
    get classList(){const node=this;return {contains:value=>node.className.split(/\s+/).includes(value),add(...values){node.className=[...new Set([...node.className.split(/\s+/).filter(Boolean),...values])].join(' ');},remove(...values){node.className=node.className.split(/\s+/).filter(v=>!values.includes(v)).join(' ');},toggle(value,force){const enabled=force??!this.contains(value);if(enabled)this.add(value);else this.remove(value);return enabled;}};}
    get firstChild(){return this.childNodes[0]||null;}get children(){return this.childNodes.filter(n=>n.nodeType===1);}
    get previousElementSibling(){if(!this.parentNode)return null;const siblings=this.parentNode.children,index=siblings.indexOf(this);return siblings[index-1]||null;}
    insertBefore(item,reference){if(reference==null){this.append(item);return item;}if(reference.parentNode!==this)throw Error('reference is not a child');item.remove();item.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(reference),0,item);return item;}
    get textContent(){return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
    set textContent(value){if(this.nodeType===3){this.data=value==null?'':String(value);return;}this.replaceChildren();if(value!=null&&value!=='')this.append(String(value));}
    append(...items){for(let item of items){if(!(item instanceof Node))item=new Node(null,String(item));item.remove();item.parentNode=this;this.childNodes.push(item);}}
    prepend(...items){const old=[...this.childNodes];this.replaceChildren(...items,...old);}
    after(...items){if(!this.parentNode)return;const parent=this.parentNode,index=parent.childNodes.indexOf(this);for(let item of items){if(!(item instanceof Node))item=new Node(null,String(item));item.remove();item.parentNode=parent;}parent.childNodes.splice(index+1,0,...items);}
    before(...items){if(!this.parentNode)return;for(let item of items){if(!(item instanceof Node))item=new Node(null,String(item));this.parentNode.insertBefore(item,this);}}
    remove(){if(this.parentNode){const list=this.parentNode.childNodes;list.splice(list.indexOf(this),1);this.parentNode=null;}}
    replaceChildren(...items){for(const child of [...this.childNodes])child.remove();this.append(...items);}
    setAttribute(key,value){value=String(value);if(key==='id')this.id=value;else this.attributes[key]=value;if(key==='hidden')this.hidden=true;if(key==='disabled')this.disabled=true;}
    getAttribute(key){return this.attributes[key]??null;}removeAttribute(key){delete this.attributes[key];}
    matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));return this.tagName===selector.toLowerCase();}
    querySelectorAll(selector){const result=[],branches=selector.split(',').map(s=>s.trim().split(/\s+/));const walk=node=>{for(const child of node.children){for(const parts of branches){if(!child.matches(parts.at(-1)))continue;let parent=child.parentNode,index=parts.length-2;while(index>=0&&parent){if(parent.matches(parts[index]))index--;parent=parent.parentNode;}if(index<0){result.push(child);break;}}walk(child);}};walk(this);return result;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    set innerHTML(html){this.replaceChildren();const stack=[this];for(const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g)){const token=match[0];if(token.startsWith('<!'))continue;if(token.startsWith('</')){stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1).append(token);continue;}const tag=token.match(/^<([\w-]+)/)[1].toLowerCase(),node=new Node(tag);for(const attr of token.slice(tag.length+1).matchAll(/([\w:-]+)(?:="([^"]*)")?/g)){node.setAttribute(attr[1],attr[2]??'');}stack.at(-1).append(node);if(!voidTags.has(tag)&&!token.endsWith('/>'))stack.push(node);}}
    addEventListener(type,listener){this.listeners[type]=listener;}scrollIntoView(){}focus(){}getContext(){return {drawImage(){}};}
  }
  const root=new Node('document');root.innerHTML=markup;
  const document={createElement:tag=>new Node(tag),createTextNode:text=>new Node(null,text),getElementById:id=>root.querySelector('#'+id),querySelector:selector=>root.querySelector(selector),querySelectorAll:selector=>root.querySelectorAll(selector)};
  return {document,elements,root};
}
