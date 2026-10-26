import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createRequire,Module} from 'node:module';
const require=createRequire(import.meta.url),React=require('react');
const filename=new URL('../src/components/DicePanel.tsx',import.meta.url).pathname;
const bundle=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','react-dom']});
const loaded=new Module(filename);loaded.paths=Module._nodeModulePaths(process.cwd());loaded._compile(bundle.outputFiles[0].text,filename);
const {DicePanel}=loaded.exports;
function find(node,type){if(!node||typeof node!=='object')return null;if(Array.isArray(node))return node.map(n=>find(n,type)).find(Boolean);return node.type===type?node:find(node.props?.children,type);}
function panel(t,onRoll=async()=>({ok:true})){
 const slots=[];let cursor=0;const old={useState:React.useState,useRef:React.useRef};
 React.useState=initial=>{const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];};
 React.useRef=value=>{const i=cursor++;slots[i]??={current:value};return slots[i];};
 t.after(()=>Object.assign(React,old));
 const render=()=>{cursor=0;return find(DicePanel({onRoll}),'textarea');};
 const input=value=>render().props.onChange({target:{value}});
 const key=(key,extra={})=>{const field=render(),value=field.props.value;let prevented=false;
  field.props.onKeyDown({key,nativeEvent:{},currentTarget:{value,selectionStart:value.length,selectionEnd:value.length},preventDefault(){prevented=true;},...extra});return prevented;};
 return {render,input,key,tick:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('actual textarea recalls successful named and secret commands, restores draft, and never rolls on arrows',async t=>{
 const calls=[],p=panel(t,async request=>{calls.push(request);return {ok:true};});
 p.input('/r 1d12+5 -n "ascia"');p.key('Enter');await p.tick();
 p.input('/rs 1d8');p.key('Enter');await p.tick();assert.equal(calls.length,2);
 p.input('/r bozza');p.key('ArrowUp');assert.equal(p.render().props.value,'/rs 1d8');
 p.key('ArrowUp');assert.equal(p.render().props.value,'/r 1d12+5 -n "ascia"');
 p.key('ArrowDown');p.key('ArrowDown');assert.equal(p.render().props.value,'/r bozza');assert.equal(calls.length,2);
 assert.equal(calls[0].name,'ascia');assert.equal(calls[1].visibility,'secret');
});
test('IME, selection, multiline editing, modifiers and empty history keep native arrow behavior',async t=>{
 const p=panel(t);p.input('/r 1d6');assert.equal(p.key('ArrowUp'),false);p.key('Enter');await p.tick();
 p.input('prima\nseconda');const value=p.render().props.value;
 assert.equal(p.key('ArrowUp',{currentTarget:{value,selectionStart:8,selectionEnd:8}}),false);
 assert.equal(p.key('ArrowUp',{nativeEvent:{isComposing:true}}),false);
 assert.equal(p.key('ArrowUp',{ctrlKey:true}),false);
 assert.equal(p.key('ArrowUp',{currentTarget:{value,selectionStart:0,selectionEnd:2}}),false);
 assert.equal(p.render().props.value,value);
});
test('repeated Enter during a pending request sends only once and failed commands are not remembered',async t=>{
 let release,calls=0;const p=panel(t,()=>{calls++;return new Promise(resolve=>{release=resolve;});});
 p.input('/r 1d6');p.key('Enter');p.key('Enter');assert.equal(calls,1);
 release({ok:false,message:'Rifiutato'});await p.tick();assert.equal(p.render().props.value,'/r 1d6');
 p.input('bozza');assert.equal(p.key('ArrowUp'),false);assert.equal(p.render().props.value,'bozza');
});
