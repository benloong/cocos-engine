'use strict';
const fs=require('fs'),path=require('path');
const cases=[];
const polygon=points=>[['moveTo',...points[0]],...points.slice(1).map(p=>['lineTo',...p])];
const shapes=[
    [['rect',-400,-300,800,600]],
    [['rect',10,20,-80,40]],
    [['ellipse',0,0,120,30]],
    [['circle',100,-10,50]],
    [['roundRect',-20,5,140,60,18]],
    [['roundRect',30,40,-140,-60,18]],
    [['roundRect',10,5,30,80,100]],
    [['arc',0,0,70,.2,5.7,false]],
    [['arc',0,0,70,.2,5.7,true]],
    [['arc',0,0,30,0,9,false]],
    polygon([[0,0],[40,0],[40,40],[20,15],[0,40]]),
    polygon([[0,0],[40,0],[40,40],[20,15],[0,40]].reverse()),
    polygon([[0,0],[50,0],[50,50],[30,50],[30,10],[20,10],[20,50],[0,50]]),
    polygon([[0,0],[0,0],[20,0],[40,0],[40,40],[0,40],[0,0]]),
    polygon([[0,0],[40,40],[0,40],[40,0]]),
    polygon([[0,0],[40,0],[.1,.1],[40,30]]),
    [['moveTo',0,0],['bezierCurveTo',-80,160,160,-80,100,100],['lineTo',0,100]],
    [['moveTo',0,0],['quadraticCurveTo',80,160,150,0],['lineTo',0,0]],
    polygon(Array.from({length:101},(_,i)=>{const a=i/101*Math.PI*2,r=i%2?20:40;return [Math.cos(a)*r,Math.sin(a)*r];})),
];
for(let s=0;s<shapes.length;s++) {
    cases.push({name:`fill-${s}`,commands:[...shapes[s],['fill']]});
    for(let cap=0;cap<3;cap++)for(let join=0;join<3;join++)for(const width of [1,15])for(const closed of [false,true]) {
        cases.push({name:`stroke-${s}-${cap}-${join}-${width}-${closed}`,commands:[['lineCap',cap],['lineJoin',join],['lineWidth',width],['miterLimit',width===1?10:1.5],...shapes[s],...(closed?[['close']]:[]),['stroke']]});
    }
}
cases.push({name:'multiple-fill-stroke-and-styles',commands:[
    ['fillColor',200,10,20,128],['rect',0,0,20,40],['rect',50,10,30,80],['fill'],['strokeColor',0,30,200,180],['lineWidth',4],['stroke'],
    ['fillColor',20,200,10,255],['circle',100,0,40],['fill'],
]});
cases.push({name:'clear-releases-paths-and-mesh',commands:[['circle',0,0,50],['fill'],['clear'],['rect',0,0,5,5],['fill']]});
cases.push({name:'large-z-order-fill',commands:[...polygon(Array.from({length:5000},(_,i)=>{
    const a=i/5000*Math.PI*2,r=i%2?800:1000;return [Math.cos(a)*r,Math.sin(a)*r];
})),['fill']]});
// Deterministic radial polygons exercise many concave triangulations without
// depending on a native implementation to generate the expected mesh.
let state=12345;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
for(let k=0;k<80;k++) {
    const count=5+k%37;
    const points=Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2,r=5+random()*100;return [Math.cos(a)*r,Math.sin(a)*r];});
    cases.push({name:`random-fill-${k}`,commands:[...polygon(points),['fill']]});
}
const out=path.join(__dirname,'build/graphics-geometry-input.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(cases));console.log(`${cases.length} Graphics geometry fixtures: ${out}`);
