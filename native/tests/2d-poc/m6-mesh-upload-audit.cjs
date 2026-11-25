'use strict';

// Source hooks for the isolated measurement checkout. Normal engine builds have no audit counters.
const include = '#include "M6MeshUploadAudit.h"\n';
const batcher = '2d/renderer/Batcher2d.h';
const draw = '2d/renderer/RenderDrawInfo.h';
const editFunction = (signature, counter) => [signature, signature + '\n    m6mesh::Timer timer(m6mesh::' + counter + ');'];
const retain = 'curdrawBatch->retainInputAssembler(ia, drawInfo->_tracksMeshChanges ? drawInfo->_mesh.get() : nullptr);';
const model = 'curdrawBatch->setInputAssembler(submodel->getInputAssembler());';
const timedCall = call => '{ m6mesh::Timer timer(m6mesh::RETAIN_NS); ' + call + ' }';

module.exports = {
    'native/cocos/2d/renderer/Batcher2d.cpp': [
        ['#include "' + batcher + '"', include + '#include "' + batcher + '"'],
        editFunction('void Batcher2d::update() {', 'UPDATE_NS'),
        editFunction('void Batcher2d::generateBatch(RenderEntity* entity, RenderDrawInfo* drawInfo) {', 'GENERATE_NS'),
        editFunction('void Batcher2d::SpriteMeshPage::append(RenderDrawInfo *source) {', 'APPEND_NS'),
        editFunction('void Batcher2d::uploadBuffers() {', 'UPLOAD_NS'),
        editFunction('void Batcher2d::reset() {', 'RESET_NS'),
        [retain, timedCall(retain)],
        ...['renderMat', '_maskClearMtl'].map(material => {
            const call = model + '\n        curdrawBatch->setDescriptorSet(submodel->getDescriptorSet());\n\n        curdrawBatch->fillPass(' + material;
            return [call, call.replace(model, timedCall(model))];
        }),
        ['curdrawBatch->setInputAssembler(ia);', timedCall('curdrawBatch->setInputAssembler(ia);')],
        ['ia = drawInfo->requestIA(getDevice());', `ia = drawInfo->requestIA(getDevice());
        ++m6mesh::counters[m6mesh::DRAWS];
        if (drawInfo->_tracksMeshChanges && drawInfo->getVbCount() && drawInfo->getIbCount()) {
            if (!drawInfo->_uploadVertices) {
                const auto stride = drawInfo->getStride() ? drawInfo->getStride() : 9U;
                m6mesh::check(ia->getVertexBuffers()[0], drawInfo->getVDataBuffer(), drawInfo->getVbCount() * stride * sizeof(float), false);
            }
            if (!drawInfo->_uploadIndices) {
                m6mesh::check(ia->getIndexBuffer(), drawInfo->getIDataBuffer(), drawInfo->getIbCount() * sizeof(uint16_t), true);
            }
        }`],
    ],
    'native/cocos/2d/renderer/RenderDrawInfo.cpp': [
        ['#include "' + draw + '"', include + '#include "' + draw + '"'],
        ...[['vBuffer', '_vDataBuffer', false], ['iBuffer', '_iDataBuffer', true]].map(([buffer, data, index]) => {
            const call = buffer + '->update(' + data + ');';
            return [call, call + '\n        m6mesh::record(' + buffer + ', ' + data + ', ' + index + ');'];
        }),
    ],
};
