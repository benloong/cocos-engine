import fs from 'fs';
import { Color } from '../../cocos/core';
import { Impl } from '../../cocos/2d/assembler/graphics/webgl/impl';
import { GraphicsAssembler } from '../../cocos/2d/assembler/graphics/webgl/graphics-assembler';

// The runner compiles and supplies native outputs; ordinary Web Jest runs do
// not claim native parity when that executable has not been built.
(process.env.CC_GRAPHICS_GEOMETRY_FIXTURE ? test : test.skip)('native Graphics meshes match the actual Web path helpers, earcut and stroke assembler', () => {
    const file=process.env.CC_GRAPHICS_GEOMETRY_FIXTURE;
    if(!file) throw new Error('Run native/tests/2d-poc/run-m6-graphics-geometry-parity.ps1');
    const { inputs, backends }=JSON.parse(fs.readFileSync(file,'utf8'));
    expect(inputs.length).toBeGreaterThan(700);
    expect(backends.length).toBeGreaterThan(0);
    const expected=inputs.map(({ commands })=>{
        const mesh={vData:new Float32Array(200000),iData:new Uint32Array(200000),vertexStart:0,indexStart:0};
        const graphics:any={lineWidth:1,miterLimit:10,lineCap:0,lineJoin:2,fillColor:Color.WHITE.clone(),strokeColor:Color.BLACK.clone(),_markForUpdateRenderData() {}};
        const impl=new Impl(graphics);graphics.impl=impl;
        const assembler=new GraphicsAssembler();
        (assembler as any).getRenderData=()=>mesh;
        for(const [op,...args] of commands) {
            if(op==='fill' || op==='stroke') assembler[op](graphics);
            else if(op==='clear') { impl.clear();mesh.vertexStart=0;mesh.indexStart=0; }
            else if(op==='fillColor' || op==='strokeColor') graphics[op]=new Color(...args);
            else if(['lineWidth','miterLimit','lineCap','lineJoin'].includes(op)) graphics[op]=args[0];
            else impl[op](...args);
        }
        return {vertices:Array.from(mesh.vData.slice(0,mesh.vertexStart*8)),indices:Array.from(mesh.iData.slice(0,mesh.indexStart))};
    });
    for(const { name, outputs } of backends) {
        expect(outputs.length).toBe(inputs.length);
        outputs.forEach((actual,index)=>{
            const web=expected[index];
            if(actual.vertices.length!==web.vertices.length || actual.indices.length!==web.indices.length) {
                throw new Error(`${name}: ${inputs[index].name}: sizes native ${actual.vertices.length}/${actual.indices.length} Web ${web.vertices.length}/${web.indices.length}`);
            }
            if(actual.indices.some((v,i)=>v!==web.indices[i])) throw new Error(`${name}: ${inputs[index].name}: triangle indices differ`);
            actual.vertices.forEach((v,i)=>{
                if(!Number.isFinite(v) || !Number.isFinite(web.vertices[i]) || Math.abs(v-web.vertices[i])>Math.max(0.00002,Math.abs(web.vertices[i])*0.000001)) throw new Error(`${name}: ${inputs[index].name}: vertex ${i}: ${v} vs ${web.vertices[i]}`);
            });
        });
    }
},120000);
