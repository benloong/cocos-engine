/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <filesystem>
#include <functional>
#include <memory>
#include <limits>
#include <thread>
#include <vector>

#include "base/Log.h"
#include "bindings/manual/jsb_scene_manual.h"
#include "bindings/auto/jsb_2d_auto.h"
#include "bindings/auto/jsb_scene_auto.h"
#include "2d/components/Sprite.h"
#include "2d/components/Label.h"
#include "scene/DrawBatch2D.h"
#include "2d/components/RichText.h"
#include "2d/components/Graphics.h"
#include "core/builtin/BuiltinResMgr.h"
#include "2d/assets/TTFFont.h"
#include "2d/assets/LabelAtlas.h"
#include "2d/components/Mask.h"
#include "2d/assets/SpriteFrame.h"
#include "2d/assets/SpriteAtlas.h"
#include "2d/framework/UIOpacity.h"
#include "2d/framework/UITransform.h"
#include "2d/framework/RenderRoot2D.h"
#include "2d/renderer/RenderDrawInfo.h"
#include "2d/renderer/LetterAtlas.h"
#include "2d/renderer/RenderEntity.h"
#include "2d/renderer/Batcher2d.h"
#include "2d/renderer/SpriteGeometry.h"
#include "2d/renderer/RichTextParser.h"
#include "2d/renderer/RichTextLayout.h"
#include "bindings/jswrapper/SeApi.h"
#include "bindings/manual/jsb_platform.h"
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
#include <windows.h>
#include <winternl.h>
size_t getFontAliasLeaseCount();
size_t getFontAliasGroupCount();
#endif
#include "bindings/manual/jsb_global.h"
#include "core/Root.h"
#include "core/assets/Material.h"

#include "core/assets/Texture2D.h"
#include "core/assets/RenderTexture.h"
#include "core/assets/ImageAsset.h"
#include "core/scene-graph/Node.h"
#include "core/scene-graph/Scene.h"
#include "math/Mat4.h"
#include "platform/FileUtils.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"
#include "renderer/GFXDeviceManager.h"

#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    #include <windows.h>
    #include <objbase.h>
    #include <psapi.h>
    #include "platform/win32/modules/DirectWriteFont.h"
#endif

// UniversalPlatform references this entry point when the engine library is
// linked into a console program.
int cocos_main(int /*argc*/, const char ** /*argv*/) {
    return 0;
}

bool register_all_native2d(se::Object *globalObject);
bool register_all_engine(se::Object *globalObject);
bool register_all_assets(se::Object *globalObject);
bool register_all_scene(se::Object *globalObject);

namespace {

int gFailures = 0;

cc::IntrusivePtr<cc::SpriteFrame> makeSquareFrame(cc::TextureBase *texture, float size) {
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->setTexture(texture);
    frame->setRect(0.F, 0.F, size, size);
    frame->setOriginalSize(size, size);
    return frame;
}

void check(bool condition, const char *message) {
    if (!condition) {
        std::printf("FAIL: %s\n", message);
        ++gFailures;
    }
}

std::vector<uint8_t> submittedTexturePixels(cc::RenderEntity *entity) {
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    if (entity->getStaticDrawInfoSize() != 1) {
        check(false, "Expected one submitted Label draw");
        return {};
    }
    auto *texture = entity->getStaticRenderDrawInfo(0)->getTexture();
    if (!texture) {
        check(false, "Expected a submitted Label texture");
        return {};
    }
    cc::gfx::BufferTextureCopy region{};
    region.texExtent.width = texture->getWidth();
    region.texExtent.height = texture->getHeight();
    std::vector<uint8_t> rgba(static_cast<size_t>(region.texExtent.width) * region.texExtent.height * 4U);
    uint8_t *buffer = rgba.data();
    cc::Root::getInstance()->getDevice()->copyTextureToBuffers(texture, &buffer, &region, 1);
    return rgba;
}

uint32_t countLabelCoverage(cc::Label &label) {
    const auto pixels = submittedTexturePixels(label.getRenderEntity());
    const uint8_t background = label.getCacheMode() == 2 ? 0 : 1;
    uint32_t covered = 0;
    for (size_t i = 3; i < pixels.size(); i += 4) {
        if (pixels[i] > background) ++covered;
    }
    return covered;
}

bool readLabelCoverage(se::State &state) {
    if (state.args().size() != 1 || !state.args()[0].isObject()) return false;
    auto *object = state.args()[0].toObject();
    if (object->_getClass() != __jsb_cc_Label_class) return false;
    auto *label = static_cast<cc::Label *>(object->getPrivateData());
    if (!label) return false;
    state.rval().setUint32(countLabelCoverage(*label));
    return true;
}
SE_BIND_FUNC(readLabelCoverage)

bool readLabelText(se::State &state) {
    if (state.args().size() != 1 || !state.args()[0].isObject()) return false;
    auto *object = state.args()[0].toObject();
    if (object->_getClass() != __jsb_cc_Label_class) return false;
    auto *label = static_cast<cc::Label *>(object->getPrivateData());
    if (!label) return false;
    state.rval().setString(label->getString());
    return true;
}
SE_BIND_FUNC(readLabelText)

bool readRendererEntity(se::State &state) {
    if (state.args().size() != 1 || !state.args()[0].isObject()) return false;
    auto *object = state.args()[0].toObject();
    auto *data = object->getPrivateData();
    if (!data) return false;
    auto *type = object->_getClass();
    if (type == __jsb_cc_Sprite_class) {
        return nativevalue_to_se(static_cast<cc::Sprite *>(data)->getRenderEntity(), state.rval(), nullptr);
    }
    if (type == __jsb_cc_Graphics_class) {
        return nativevalue_to_se(static_cast<cc::Graphics *>(data)->getRenderEntity(), state.rval(), nullptr);
    }
    return false;
}
SE_BIND_FUNC(readRendererEntity)

template <class T>
T *getChildRenderer(const cc::Node &host, size_t index) {
    const auto &children = host.getChildren();
    if (index >= children.size()) return nullptr;
    return static_cast<T *>(children[index]->getUIComponent(T::TYPE_ID));
}

bool readRichTextSegment(se::State &state) {
    const auto &args = state.args();
    if (args.size() != 3 || !args[0].isObject() || !args[1].isNumber() || !args[2].isBoolean()) return false;
    const auto *object = args[0].toObject();
    if (object->_getClass() != __jsb_cc_Node_class) return false;
    const auto *host = static_cast<cc::Node *>(object->getPrivateData());
    if (!host) return false;
    const auto index = args[1].toUint32();
    if (args[2].toBoolean()) return nativevalue_to_se(getChildRenderer<cc::Sprite>(*host, index), state.rval(), nullptr);
    return nativevalue_to_se(getChildRenderer<cc::Label>(*host, index), state.rval(), nullptr);
}
SE_BIND_FUNC(readRichTextSegment)

void checkNear(float actual, float expected, const char *message) {
    if (std::fabs(actual - expected) > 1e-4F) {
        std::printf("FAIL: %s expected %f got %f\n", message, expected, actual);
        ++gFailures;
    }
}

void checkClose(float actual, float expected, float epsilon, const char *message) {
    if (std::fabs(actual - expected) > epsilon) {
        std::printf("FAIL: %s expected %f got %f\n", message, expected, actual);
        ++gFailures;
    }
}

void testSpriteAtlas() {
    cc::IntrusivePtr<cc::SpriteAtlas> atlas(new cc::SpriteAtlas());
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    check(atlas != nullptr && frame != nullptr, "SpriteAtlas/frame allocated");
    atlas->addSpriteFrame("icon", frame);
    check(atlas->getSpriteFrameNames().size() == 1, "SpriteAtlas count after add");
    check(atlas->getSpriteFrame("icon") == frame, "SpriteAtlas lookup by name");
    atlas->removeSpriteFrame("icon");
    check(atlas->getSpriteFrameNames().empty() && atlas->getSpriteFrame("icon") == nullptr, "SpriteAtlas count after remove");
    atlas->addSpriteFrame("icon", frame);
    atlas->clear();
    check(atlas->getSpriteFrameNames().empty() && atlas->getSpriteFrame("icon") == nullptr, "SpriteAtlas count after clear");
    const auto retained = frame->getRefCount();
    cc::IntrusivePtr<cc::Texture2D> firstTexture(new cc::Texture2D());
    firstTexture->create(2, 2);
    frame->setTexture(firstTexture);
    atlas->setSpriteFrames({"hero", "empty"}, {frame.get(), nullptr});
    check(atlas->getSpriteFrameNames().size() == 2, "SpriteAtlas retains null named slots");
    check(atlas->getTexture() == firstTexture, "SpriteAtlas first named slot chooses texture");
    check(frame->getRefCount() == retained + 1, "SpriteAtlas owns loaded frame");
    atlas->setSpriteFrameOrder({"empty", "hero"});
    check(atlas->getTexture() == nullptr, "SpriteAtlas null first slot matches Web");
    atlas->setSpriteFrames({"renamed", "alias"}, {frame.get(), frame.get()});
    check(frame->getRefCount() == retained + 2, "SpriteAtlas replace retains aliases before release");
    check(atlas->getSpriteFrame("hero") == nullptr && atlas->getSpriteFrame("renamed") == frame,
          "SpriteAtlas replace removes old keys");
    for (int i = 0; i < 1000; ++i) {
        atlas->setSpriteFrames({"frame", "empty"}, {frame.get(), nullptr});
        atlas->clear();
    }
    check(frame->getRefCount() == retained, "SpriteAtlas replace/clear releases all frame references");
    for (int i = 0; i < 1000; ++i) {
        cc::IntrusivePtr<cc::SpriteAtlas> released(new cc::SpriteAtlas());
        released->setSpriteFrames({"frame", "alias"}, {frame.get(), frame.get()});
        check(released->destroy(), "SpriteAtlas queues deferred destruction");
        check(released->isValid() && released->getSpriteFrame("frame") == frame
                  && frame->getRefCount() == retained + 2,
              "SpriteAtlas keeps owned frames until deferred destruction");
        released->addSpriteFrame("late", frame);
        released->setSpriteFrames({"late"}, {frame.get()});
        check(released->getSpriteFrameNames().size() == 2 && released->getSpriteFrame("frame") == frame,
              "SpriteAtlas does not accept pending replacements");
        cc::CCObject::deferredDestroy();
        released->addSpriteFrame("late", frame);
        released->setSpriteFrameOrder({"late"});
        check(!released->isValid() && released->getSpriteFrame("alias") == nullptr
                  && released->getSpriteFrameNames().empty() && released->getTexture() == nullptr
                  && frame->getRefCount() == retained,
              "SpriteAtlas releases aliases and rejects late repopulation with a live owner");
    }
}
void testSpriteFrameData() {
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D());
    texture->create(128, 256);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->setRect(7, 11, 40, 28);
    frame->setOriginalSize(60, 50);
    frame->setOffset(3, -2);
    frame->setInsets(5, 9, 6, 8);
    frame->setRotated(true);
    frame->loadTexture(texture);
    checkNear(frame->getRectWidth(), 40, "dependency texture preserves serialized rect");
    checkNear(frame->getOriginalWidth(), 60, "dependency texture preserves original size");
    auto uv = frame->getUV();
    check(uv.size() == 8 && frame->getSlicedUV().size() == 32, "native frame UV sizes");
    checkNear(uv[0], 7.F / 128.F, "native frame rotated UV");
    for (int flags = 0; flags < 8; ++flags) {
        frame->setRotated((flags & 1) != 0);
        frame->setFlipUVX((flags & 2) != 0);
        frame->setFlipUVY((flags & 4) != 0);
        const auto spriteUV = frame->getUV();
        const auto meshUV = frame->getMeshUVs(true);
        check(meshUV.size() == spriteUV.size(), "native sprite and mesh use the same quad topology");
        for (size_t i = 0; i < meshUV.size(); i += 2) {
            checkNear(static_cast<float>(meshUV[i]), spriteUV[i], "oriented mesh and sprite U address the same corner");
            checkNear(static_cast<float>(meshUV[i + 1]), 1.F - spriteUV[i + 1], "oriented mesh V uses bottom-origin coordinates");
        }
    }
    frame->setRotated(true);
    frame->setFlipUVX(false);
    frame->setFlipUVY(false);
    auto border = frame->getTrimmedBorder();
    checkNear(border[0], 13, "native trimmed left border");
    checkNear(border[3], -13, "native trimmed top border");
    cc::IntrusivePtr<cc::SpriteFrame> copy(new cc::SpriteFrame());
    const auto flipRevision = frame->getRevision();
    frame->setFlipUVX(true);
    check(frame->getRevision() != flipRevision, "frame flip updates revision");
    frame->setPivotX(0.25F);
    frame->setPackable(false);
    frame->setAtlasUuid("atlas");
    copy->copyFrom(frame);
    copy->setRectWidth(10);
    checkNear(frame->getRectWidth(), 40, "native clone has independent geometry");
    check(copy->getTexture() == texture && copy->getFlipUVX() && !copy->getPackable(), "native clone copies texture and flags");
    check(copy->getAtlasUuid() == "atlas" && copy->getPivotX() == 0.25F, "native clone copies metadata");
    copy->resetFrame(false);
    checkNear(copy->getRectWidth(), 10, "reset without clear preserves geometry");
    copy->resetFrame(true);
    checkNear(copy->getRectWidth(), 0, "reset clear removes geometry");
    copy->resetWithTexture(texture);
    checkNear(copy->getRectWidth(), 128, "public texture reset uses texture size");
    checkNear(copy->getOriginalHeight(), 256, "public texture reset initializes original size");
    for (int i = 0; i < 1000; ++i) {
        cc::IntrusivePtr<cc::SpriteFrame> temporary(new cc::SpriteFrame());
        temporary->copyFrom(frame);
        temporary->setTexture(nullptr);
    }
    check(frame->getTexture() == texture, "clone/release keeps original texture alive");
    cc::IntrusivePtr<cc::Texture2D> packed(new cc::Texture2D());
    packed->create(512, 512);
    const auto sourceRefs = texture->getRefCount();
    const auto packedRefs = packed->getRefCount();
    const auto restoredUV = frame->getUV();
    const auto meshUV = frame->getMeshUVs(true);
    const auto meshPixelUV = frame->getMeshUVs(false);
    for (int i = 0; i < 1000; ++i) {
        const auto revision = frame->getRevision();
        frame->setDynamicAtlasFrame(packed, 101, 103);
        check(frame->hasDynamicAtlasFrame() && frame->getOriginalTexture() == texture,
              "packed frame owns original texture");
        check(frame->getOriginalX() == 7 && frame->getOriginalY() == 11,
              "packed frame preserves original origin");
        check(frame->getTexture() == packed && frame->getRevision() == revision + 1,
              "packing updates active texture and consumer revision");
        check(texture->getRefCount() == sourceRefs && packed->getRefCount() == packedRefs + 1,
              "packing transfers source reference to backup and owns atlas");
        check(frame->getUV() != restoredUV && frame->getMeshUVs(true) == meshUV && frame->getMeshUVs(false) == meshPixelUV,
              "packed UI UV addresses the atlas while mesh UV addresses the original texture");
        cc::IntrusivePtr<cc::SpriteFrame> clone(new cc::SpriteFrame());
        clone->copyFrom(frame);
        check(clone->getMeshUVs(true) == meshUV && clone->getMeshUVs(false) == meshPixelUV, "packed clone retains source mesh UV");
        clone->resetDynamicAtlasFrame();
        check(clone->getTexture() == texture && clone->getUV() != frame->getUV(),
              "packed clone restores independently");
        clone = nullptr;
        frame->resetDynamicAtlasFrame();
        check(frame->getTexture() == texture && frame->getUV() == restoredUV,
              "atlas reset restores texture and flipped UV");
        check(!frame->hasDynamicAtlasFrame() && frame->getOriginalTexture() == nullptr,
              "atlas reset clears owned backup");
        check(texture->getRefCount() == sourceRefs && packed->getRefCount() == packedRefs,
              "atlas cycle releases both temporary texture references");
        const auto restoredRevision = frame->getRevision();
        frame->resetDynamicAtlasFrame();
        check(frame->getRevision() == restoredRevision, "unpacked reset is a no-op");
    }
    {
        cc::IntrusivePtr<cc::SpriteFrame> temporary(new cc::SpriteFrame());
        temporary->copyFrom(frame);
        temporary->setDynamicAtlasFrame(packed, 2, 3);
        check(texture->getRefCount() == sourceRefs + 1 && packed->getRefCount() == packedRefs + 1,
              "packed temporary explicitly owns source and atlas");
        // Copying an unpacked source must also discard a previous atlas backup.
        temporary->copyFrom(frame);
        check(!temporary->hasDynamicAtlasFrame() && packed->getRefCount() == packedRefs,
              "copy from unpacked frame releases previous atlas state");
        temporary->setDynamicAtlasFrame(packed, 2, 3);
    }
    check(texture->getRefCount() == sourceRefs && packed->getRefCount() == packedRefs,
          "packed frame destructor releases source and atlas without reset");
    for (int i = 0; i < 1000; ++i) {
        cc::IntrusivePtr<cc::SpriteFrame> released(new cc::SpriteFrame());
        released->copyFrom(frame);
        const bool withAtlas = (i % 2) != 0;
        if (withAtlas) released->setDynamicAtlasFrame(packed, 2, 3);
        const auto revision = released->getRevision();
        check(released->destroy(), "SpriteFrame queues deferred destruction");
        released->loadTexture(packed);
        released->resetWithTexture(packed);
        released->setDynamicAtlasFrame(packed, 8, 9);
        check(released->isValid() && released->getTexture() == (withAtlas ? packed.get() : texture.get())
                  && released->getRevision() == revision
                  && texture->getRefCount() == sourceRefs + 1
                  && packed->getRefCount() == packedRefs + static_cast<unsigned>(withAtlas),
              "pending SpriteFrame retains existing texture references and ignores late replacement");
        cc::CCObject::deferredDestroy();
        released->setTexture(packed);
        released->copyFrom(frame);
        check(!released->isValid() && released->getTexture() == nullptr
                  && released->getOriginalTexture() == nullptr && !released->hasDynamicAtlasFrame()
                  && released->getUV().empty() && released->getRevision() == revision + 1
                  && texture->getRefCount() == sourceRefs && packed->getRefCount() == packedRefs,
              "deferred SpriteFrame releases textures while its native wrapper is retained");
    }
}

void testUiBatchInputResources() {
    cc::RenderDrawInfo info;
    info.setIsMeshBuffer(true); info.setStride(8); info.setVbCount(4); info.setIbCount(6);
    auto *ia = info.requestIA(cc::Root::getInstance()->getDevice());
    cc::IntrusivePtr<cc::gfx::InputAssembler> iaGuard(ia);
    cc::IntrusivePtr<cc::gfx::Buffer> vertexGuard(ia->getVertexBuffers()[0]);
    cc::IntrusivePtr<cc::gfx::Buffer> indexGuard(ia->getIndexBuffer());
    const auto iaRefs = ia->getRefCount(), vbRefs = vertexGuard->getRefCount(), ibRefs = indexGuard->getRefCount();
    cc::scene::DrawBatch2D batch;
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D());
    texture->create(8, 8);
    auto *view = texture->getGFXTexture();
    auto *source = view->getViewInfo().texture;
    const auto sourceRefs = source->getRefCount(), viewRefs = view->getRefCount();
    batch.setSampledTexture(view);
    batch.setSampledTexture(view);
    check(source->getRefCount() == sourceRefs + 1 && view->getRefCount() == viewRefs + 1,
          "Queued UI batch retains both the sampled view and its source exactly once");
    batch.setInputAssembler(ia);
    check(ia->getRefCount() == iaRefs + 1, "Queued UI batch owns its IA until clear");
    check(vertexGuard->getRefCount() == vbRefs + 1 && indexGuard->getRefCount() == ibRefs + 1,
          "Queued UI batch owns IA vertex/index buffers independently of DrawInfo");
    info.resetDrawInfo();
    check(batch.getInputAssembler() == ia && ia->getRefCount() == 2, "DrawInfo reset does not invalidate queued batch IA");
    check(vertexGuard->getRefCount() == 2 && indexGuard->getRefCount() == 2, "DrawInfo reset preserves queued GPU buffers");
    batch.setInputAssembler(ia);
    batch.clear();
    check(source->getRefCount() == sourceRefs && view->getRefCount() == viewRefs,
          "Batch clear returns its texture references");
    check(batch.getInputAssembler() == nullptr && ia->getRefCount() == 1 && vertexGuard->getRefCount() == 1 && indexGuard->getRefCount() == 1,
          "Batch clear releases IA and buffer leases exactly once");
    iaGuard = nullptr; indexGuard = nullptr; vertexGuard = nullptr;
}

void testBitmapGpuGeometry() {
    cc::IntrusivePtr<cc::Texture2D> notified(new cc::Texture2D());
    cc::gfx::Texture *lastNotified = nullptr; // borrowed identity only, owned by notified
    notified->on<cc::SimpleTexture::TextureUpdated>([&](cc::SimpleTexture *emitter, cc::gfx::Texture *view) {
        check(view == emitter->getGFXTexture(), "Texture event agrees with native public GPU view");
        lastNotified = view;
    });
    notified->create(8, 8);
    check(lastNotified && lastNotified == notified->getGFXTexture(), "Texture creation publishes completed view");
    const auto notifiedId = lastNotified->getObjectID();
    notified->setMipRange(0, 0);
    check(lastNotified && lastNotified->getObjectID() != notifiedId && lastNotified == notified->getGFXTexture(), "Mip range publishes replacement view");
    notified->create(8, 8);
    check(lastNotified == notified->getGFXTexture(), "Texture recreation updates cached view");
    notified->destroy();
    check(lastNotified == nullptr, "Texture destruction clears cached view");
    cc::IntrusivePtr<cc::Texture2D> source(new cc::Texture2D()); source->create(8, 8);
    cc::IntrusivePtr<cc::Texture2D> packed(new cc::Texture2D()); packed->create(16, 16);
    std::vector<uint8_t> pixels(16 * 16 * 4, 255);
    source->uploadData(pixels.data()); packed->uploadData(pixels.data());
    check(source->getImage() == nullptr && packed->getImage() == nullptr, "GPU bitmap fixture has no CPU image fallback");
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->setTexture(source); frame->setRect(2, 3, 4, 4); frame->setOriginalSize(4, 4);
    cc::IntrusivePtr<cc::LabelAtlas> font(new cc::LabelAtlas()); font->setFontSize(4);
    check(font->setConfigJson(R"({"fontDefDictionary":{"65":{"rect":{"x":1,"y":1,"width":2,"height":2},"xOffset":0,"yOffset":0,"xAdvance":2}}})"), "GPU bitmap glyph config");
    font->setSpriteFrame(frame);
    cc::Node node("bitmap-gpu"); cc::UITransform transform(&node); transform.setContentSize(8,8);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    cc::Label label; label.setNode(&node); label.setUITransform(&transform); label.setMaterial(material);
    label.setFontSize(4); label.setLineHeight(4); label.setFontAsset(font); label.setString("AA");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    auto *entity = static_cast<cc::RenderEntity *>(node.getUserData());
    auto *draw = entity->getStaticRenderDrawInfo(0);
    check(draw && draw->getVbCount() == 8 && draw->getIbCount() == 12, "GPU bitmap submits one quad per glyph");
    check(draw && draw->getTexture() == source->getGFXTexture(), "GPU bitmap samples original atlas directly");
    if (draw) checkNear(draw->getVDataBuffer()[3], 3.F/8.F, "Bitmap glyph UV includes frame origin");
    frame->setOffset(1, 0); frame->setOriginalSize(6, 6); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    draw = entity->getStaticRenderDrawInfo(0);
    checkNear(draw->getVDataBuffer()[3], 1.F/8.F, "Bitmap frame-only offset/original-size changes invalidate native UVs");
    checkNear(draw->getVDataBuffer()[4], 5.F/8.F, "Bitmap frame trim applies vertical source correction");
    frame->setOriginalSize(4, 4); frame->setOffset(6, -1); frame->setRotated(true); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    draw = entity->getStaticRenderDrawInfo(0);
    checkNear(draw->getVDataBuffer()[3], .5F, "Rotated bitmap frame trim updates current texture coordinate");
    checkNear(draw->getVDataBuffer()[4], -.25F, "Rotated bitmap negative source origin follows Web mapping");
    checkNear(draw->getVDataBuffer()[19] - draw->getVDataBuffer()[1], 1.F, "Rotated bitmap trim updates physical glyph height");
    frame->setRotated(false); frame->setOffset(0, 0); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    frame->setDynamicAtlasFrame(packed, 6, 7); label.updateRenderData();
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); draw = entity->getStaticRenderDrawInfo(0);
    check(draw && draw->getTexture() == packed->getGFXTexture(), "GPU-only dynamic atlas is consumed without image data");
    if (draw) checkNear(draw->getVDataBuffer()[3], 7.F/16.F, "Packed glyph UV uses current atlas origin/size");
    frame->resetDynamicAtlasFrame(); label.updateRenderData(); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    draw = entity->getStaticRenderDrawInfo(0);
    check(draw && draw->getTexture() == source->getGFXTexture(), "Bitmap reset restores original GPU texture");
    source->create(32,16); pixels.resize(32 * 16 * 4, 255); source->uploadData(pixels.data()); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    draw = entity->getStaticRenderDrawInfo(0);
    if (draw) checkNear(draw->getVDataBuffer()[3], 3.F/32.F, "Bitmap UV invalidates when the same texture is resized");
    const auto oldGpuId = source->getGFXTexture()->getObjectID();
    source->create(32,16); source->uploadData(pixels.data()); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    draw = entity->getStaticRenderDrawInfo(0);
    check(source->getGFXTexture()->getObjectID() != oldGpuId && draw->getTexture() == source->getGFXTexture(),
          "Same-sized bitmap texture recreation rebinds GPU identity");
    source->setWrapMode(cc::TextureBase::WrapMode::CLAMP_TO_EDGE, cc::TextureBase::WrapMode::CLAMP_TO_EDGE);
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(entity->getStaticRenderDrawInfo(0)->getSampler() == source->getGFXSampler(), "Bitmap sampler changes rebind without font reassignment");
    const std::string sourceConfig = R"({"fontSize":4,"fontDefDictionary":{"65":{"rect":{"x":1,"y":1,"width":2,"height":2},"xOffset":0,"yOffset":0,"xAdvance":2}}})";
    check(font->setConfigJson(sourceConfig), "Bitmap source-size config accepted");
    font->setFontSize(64); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(font->hasSourceFontSize() && font->getSourceFontSize() == 4 && font->getFontSize() == 64, "Bitmap source size stays independent of metadata size");
    for (const float metadata : {-1.F, 0.F, 64.F}) {
        font->setFontSize(metadata);
        checkNear(label.measureUnwrappedText("AA").width, 4.F, "Default/zero/positive metadata sizes do not rescale configured glyphs");
    }
    const auto sourceRevision = font->getConfigRevision();
    for (const auto *invalid : {R"({"fontSize":1e100})", R"({"fontSize":null})", R"({"fontSize":"16"})"}) {
        check(!font->setConfigJson(invalid), "Unsafe source-size config rejected");
        check(font->getConfigRevision() == sourceRevision && font->getConfigJson() == sourceConfig && font->getSourceFontSize() == 4, "Invalid source size preserves complete config atomically");
    }
    for (const auto emptySource : {0, -1}) {
        auto emptyConfig = sourceConfig;
        emptyConfig.replace(emptyConfig.find(":4,"), 3, ":" + std::to_string(emptySource) + ",");
        check(font->setConfigJson(emptyConfig), "Nonpositive source-size data accepted without non-finite geometry");
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        const auto emptyMeasure = label.measureUnwrappedText("AA");
        checkNear(emptyMeasure.width, 0.F, "Nonpositive configured source size has empty measurement width");
        checkNear(emptyMeasure.height, 0.F, "Nonpositive configured source size has empty measurement height");
        check(entity->getStaticDrawInfoSize() == 0, "Nonpositive configured source size clears old GPU submissions");
    }
    check(font->setConfigJson(R"({"fontSize":8,"fontDefDictionary":{"65":{"rect":{"x":1,"y":1,"width":2,"height":2},"xOffset":0,"yOffset":0,"xAdvance":2}}})"), "Bitmap source size reload");
    label.updateRenderData();
    checkNear(label.getContentWidth(), 2.F, "Config source-size reload invalidates existing Label without font reassignment");
    font->setConfigJson(sourceConfig);
    label.setFontSize(8); label.setSpacingX(2); label.setLineHeight(6);
    const auto measured = label.measureUnwrappedText("AA");
    checkNear(measured.width, 10.F, "Bitmap measurement scales glyphs and applies spacing");
    checkNear(measured.height, 6.F, "Bitmap measurement uses configured line height without TTF baseline padding");
    label.setSpacingX(2.F + 1.F / 128.F);
    checkNear(label.measureUnwrappedText("AA").width, 10.01F, "Bitmap measurement rounds after applying sub-hundredth spacing changes");
    label.setSpacingX(0);
    label.setFontSize(8.F + 1.F / 128.F);
    checkNear(label.measureUnwrappedText(std::string(256, 'A')).width, 1025.F, "Bitmap layout uses fractional font size changes");
    label.setLineHeight(6.F + 1.F / 128.F);
    checkNear(label.measureUnwrappedText("A\nA").height, 12.02F, "Bitmap layout uses fractional line height changes");
    label.setOverflow(1); transform.setContentSize(24, 12); label.updateRenderData();
    checkNear(label.getContentWidth(), 24.F, "Bitmap clamp preserves fixed content width");
    transform.setContentSize(20, 10); label.updateRenderData();
    checkNear(label.getContentWidth(), 20.F, "Explicit bitmap update observes transform resize before prepare");
    checkNear(label.getContentHeight(), 10.F, "Explicit bitmap update preserves new clamp height");
    label.setOverflow(0); label.setFontSize(4); label.setSpacingX(0); label.setLineHeight(4);
    const auto checkGlyphDraws = [entity](uint32_t glyphs, uint32_t chunks) {
        uint32_t vertices = 0;
        uint32_t indices = 0;
        for (uint32_t i = 0; i < entity->getStaticDrawInfoSize(); ++i) {
            auto *draw = entity->getStaticRenderDrawInfo(i);
            vertices += draw->getVbCount();
            indices += draw->getIbCount();
        }
        check(entity->getStaticDrawInfoSize() == chunks && vertices == glyphs * 4 && indices == glyphs * 6,
              "All submitted bitmap chunks contain the expected glyph quads");
    };
    label.setString(std::string(17000, 'A')); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkGlyphDraws(17000, 2);
    check(entity->getStaticRenderDrawInfo(0)->getVbCount() == 65532 && entity->getStaticRenderDrawInfo(1)->getVbCount() == 2468,
          "Bitmap chunks respect 16-bit mesh-buffer limits");
    label.setString(std::string(70000, 'A')); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkGlyphDraws(70000, 5);
    check(entity->getRenderDrawInfoAt(4) == entity->getStaticRenderDrawInfo(4), "Batcher indexed access reaches owned overflow DrawInfo");
    auto *overflow = entity->getStaticRenderDrawInfo(4);
    check(overflow->getVbCount() == 17872 && overflow->getIbCount() == 26808, "Final bitmap chunk contains all remaining glyphs");
    entity->updateInheritedOpacity(.25F);
    for (uint32_t i = 0; i < entity->getStaticDrawInfoSize(); ++i) {
        auto *chunk = entity->getStaticRenderDrawInfo(i);
        checkNear(chunk->getVDataBuffer()[(chunk->getVbCount() - 1) * chunk->getStride() + 8], .25F,
                  "inherited alpha reaches the last vertex of every bitmap Label chunk");
    }
    label.setString(""); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(overflow->getMaterial() == nullptr && overflow->getTexture() == nullptr && overflow->getVDataBuffer() == nullptr,
          "Inactive overflow slots release resources and borrowed buffers");
    checkGlyphDraws(0, 0);
    label.setFontAsset(nullptr); label.setNode(nullptr);
    font->clearNativeData();
    check(!font->hasSourceFontSize() && font->getSourceFontSize() == -1, "Clearing bitmap asset releases configured source-size state");
}

void testFrameConsumers() {
    std::vector<uint8_t> pixels(16, 255);
    cc::IntrusivePtr<cc::ImageAsset> image(new cc::ImageAsset());
    image->setWidth(2); image->setHeight(2); image->setData(pixels.data());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D());
    texture->setImage(image);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame());
    frame->resetWithTexture(texture);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    cc::Node labelNode("frame-bmfont");
    cc::UITransform labelTransform(&labelNode);
    cc::Label label;
    label.setNode(&labelNode);
    label.setUITransform(&labelTransform);
    label.setMaterial(material);
    cc::IntrusivePtr<cc::BitmapFontAsset> font(new cc::BitmapFontAsset());
    font->setFontSize(2);
    check(font->setConfigJson(R"({"fontSize":2,"fontDefDictionary":{"65":{"rect":{"x":0,"y":0,"width":2,"height":2},"xOffset":0,"yOffset":0,"xAdvance":2}}})"), "BMFont frame consumer loads glyph configuration");
    font->setSpriteFrame(frame);
    label.setFontAsset(font);
    label.setString("A");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(submittedTexturePixels(label.getRenderEntity()) == pixels, "BMFont consumes native SpriteFrame texture");

    cc::Node maskNode("frame-mask");
    cc::UITransform maskTransform(&maskNode);
    cc::BuiltinResMgr::getInstance()->addAsset("ui-alpha-test-material", material);
    const auto initialRefs = material->getRefCount();
    cc::Mask mask;
    mask.setNode(&maskNode);
    mask.setAlphaThreshold(0.25F);
    check(material->getRefCount() == initialRefs, "geometry Mask does not retain the Sprite stencil material");
    cc::Sprite stencil;
    stencil.setSizeMode(0);
    stencil.setNode(&maskNode);
    stencil.setFrame(frame);
    mask.setType(3);
    auto *entity = static_cast<cc::RenderEntity *>(maskNode.getUserData());
    check(entity == stencil.getRenderEntity() && entity->getIsMask(), "Mask uses the existing Sprite entity as stencil");
    if (entity) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(entity->getStaticDrawInfoSize() == 1, "Mask consumes native SpriteFrame");
        auto *instance = entity->getStaticRenderDrawInfo(0)->getMaterial();
        check(instance && instance->getParent() == material, "Sprite stencil draws with an instance of the native alpha-test material");
        const auto activeRefs = material->getRefCount();
        {
            cc::Node peerNode("peer-mask");
            cc::UITransform peerTransform(&peerNode);
            cc::Sprite peerStencil;
            peerStencil.setSizeMode(0);
            peerStencil.setNode(&peerNode);
            peerStencil.setFrame(frame);
            cc::Mask peer;
            peer.setType(3);
            peer.setNode(&peerNode);
            peer.setAlphaThreshold(0.75F);
            cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            auto *peerEntity = peer.getRenderEntity();
            auto *peerInstance = peerEntity->getStaticDrawInfoSize() ? peerEntity->getStaticRenderDrawInfo(0)->getMaterial() : nullptr;
            check(peerInstance && peerInstance != instance && peerInstance->getParent() == material,
                  "two Sprite stencils isolate per-Mask uniforms and share their parent");
        }
        check(material->getRefCount() == activeRefs, "destroying a peer Mask releases its stencil material references");
        frame->setRectWidth(1);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[12], 0.5F, "Mask sees in-place frame rect mutation");
    }

    std::vector<uint8_t> transparentPixels(16, 0);
    cc::IntrusivePtr<cc::ImageAsset> transparentImage(new cc::ImageAsset());
    transparentImage->setWidth(2); transparentImage->setHeight(2); transparentImage->setData(transparentPixels.data());
    cc::IntrusivePtr<cc::Texture2D> transparentTexture(new cc::Texture2D());
    transparentTexture->setImage(transparentImage);
    frame->setTexture(transparentTexture);
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(submittedTexturePixels(label.getRenderEntity()) == transparentPixels, "BMFont sees shared frame texture replacement");
}

#if CC_PLATFORM == CC_PLATFORM_WINDOWS
void reportDirectWriteFileFailure(const std::filesystem::path &path, const char *stage, DWORD error, bool expected = false) {
    std::fprintf(stderr, "%s stage=%s error=%lu pid=%lu path=%ls\n",
                 expected ? "M6_FONT_FILE_CONTROL" : "M6_FONT_FILE_FAILURE",
                 stage, error, GetCurrentProcessId(), path.c_str());
    // Observe only after the gate has failed. This handle must never overlap a gate check.
    HANDLE file = CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES,
                             FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
                             OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) {
        std::fprintf(stderr, "M6_FONT_FILE_OWNERS openError=%lu\n", GetLastError());
        return;
    }
    using QueryFile = NTSTATUS (NTAPI *)(HANDLE, PIO_STATUS_BLOCK, PVOID, ULONG, FILE_INFORMATION_CLASS);
    auto query = reinterpret_cast<QueryFile>(GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "NtQueryInformationFile"));
    if (query) {
        struct { ULONG count; ULONG_PTR ids[64]; } owners{};
        IO_STATUS_BLOCK statusBlock{};
        // FileProcessIdsUsingFileInformation, documented FILE_INFORMATION_CLASS value 47.
        const auto status = query(file, &statusBlock, &owners, sizeof(owners), static_cast<FILE_INFORMATION_CLASS>(47));
        std::fprintf(stderr, "M6_FONT_FILE_OWNERS status=0x%08lx count=%lu observerPid=%lu\n",
                     static_cast<unsigned long>(status), owners.count, GetCurrentProcessId());
        if (status >= 0 && owners.count <= 64) {
            for (ULONG i = 0; i < owners.count; ++i) {
                const auto pid = static_cast<DWORD>(owners.ids[i]);
                HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
                wchar_t image[1024]{}; DWORD length = 1024;
                const bool named = process && QueryFullProcessImageNameW(process, 0, image, &length);
                std::fprintf(stderr, "M6_FONT_FILE_OWNER pid=%lu observer=%d image=%ls\n",
                             pid, pid == GetCurrentProcessId(), named ? image : L"<unavailable>");
                if (process) CloseHandle(process);
            }
        }
    } else {
        std::fprintf(stderr, "M6_FONT_FILE_OWNERS queryUnavailable\n");
    }
    CloseHandle(file);
}

bool checkDirectWriteFileRelease(const std::filesystem::path &path, const char *stage = nullptr) {
    HANDLE exclusive = CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                                   OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (exclusive == INVALID_HANDLE_VALUE) {
        const DWORD error = GetLastError();
        if (stage) reportDirectWriteFileFailure(path, stage, error);
        SetLastError(error);
        return false;
    }
    const bool closed = CloseHandle(exclusive) != FALSE;
    if (!closed && stage) {
        const DWORD error = GetLastError();
        reportDirectWriteFileFailure(path, "exclusive-handle-close", error);
        SetLastError(error);
    }
    return closed;
}

bool exerciseDirectWriteFile(const std::filesystem::path &path, const char *fixture, float expectedWidth) {
    const auto fixturePath = std::filesystem::u8path(fixture);
    if (!CopyFileW(fixturePath.c_str(), path.c_str(), FALSE)) {
        reportDirectWriteFileFailure(path, "valid-font-overwrite", GetLastError());
        return false;
    }
    const std::string source = path.u8string();
    auto first = cc::DirectWriteFont::create(source, 24.F, false, false);
    auto second = cc::DirectWriteFont::create(source, 24.F, false, false);
    if (!first || !second || first->measure("Atlas 123")[0] != expectedWidth) {
        std::fprintf(stderr, "M6_FONT_FILE_FAILURE stage=valid-font-create-or-measure first=%d second=%d expected=%f actual=%f\n",
                     bool(first), bool(second), expectedWidth, first ? first->measure("Atlas 123")[0] : -1.F);
        return false;
    }
    first.reset();
    std::array<uint8_t, 32 * 32 * 4> pixels{};
    if (second->measure("Atlas 123")[0] != expectedWidth
        || !second->draw("A", 1, 24, 3, pixels.data(), 32, 32, {1, 1, 1, 1})
        || !second->stroke("A", 1, 24, 3, pixels.data(), 32, 32, {1, 1, 1, 1}, 2.F,
                           cc::DirectWriteFont::StrokeJoin::ROUND)) {
        std::fprintf(stderr, "M6_FONT_FILE_FAILURE stage=surviving-font-measure-draw-or-stroke\n");
        return false;
    }
    second.reset();
    if (!checkDirectWriteFileRelease(path, "after-valid-font-release")) return false;
    {
        HANDLE invalid = CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                     nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (invalid == INVALID_HANDLE_VALUE) {
            reportDirectWriteFileFailure(path, "invalid-file-truncate", GetLastError());
            return false;
        }
        DWORD written = 0;
        const BOOL success = WriteFile(invalid, "invalid", 7, &written, nullptr);
        const DWORD writeError = success ? ERROR_SUCCESS : GetLastError();
        const BOOL closed = CloseHandle(invalid);
        const DWORD closeError = closed ? ERROR_SUCCESS : GetLastError();
        if (!success || written != 7) {
            reportDirectWriteFileFailure(path, "invalid-file-write", success ? ERROR_WRITE_FAULT : writeError);
            return false;
        }
        if (!closed) {
            reportDirectWriteFileFailure(path, "invalid-file-close", closeError);
            return false;
        }
    }
    if (cc::DirectWriteFont::create(source, 24.F, false, false)) {
        reportDirectWriteFileFailure(path, "invalid-font-accepted", ERROR_INVALID_DATA);
        return false;
    }
    return checkDirectWriteFileRelease(path, "after-invalid-font-rejection");
}

int runDirectWriteFileProbe() {
    const char *fixtures[]{CC2D_FONT_FIXTURE, CC2D_REPLACEMENT_FONT};
    float widths[2]{};
    for (int i = 0; i < 2; ++i) {
        auto face = cc::DirectWriteFont::create(fixtures[i], 24.F, false, false);
        if (!face) return 1;
        widths[i] = face->measure("Atlas 123")[0];
    }
    if (widths[0] <= 0 || widths[1] <= 0 || widths[0] == widths[1]) return 1;
    wchar_t directory[MAX_PATH]{};
    DWORD length = GetEnvironmentVariableW(L"CC_M6_FONT_PROBE_DIRECTORY", directory, MAX_PATH);
    if (length == 0) {
        length = GetModuleFileNameW(nullptr, directory, MAX_PATH);
        if (length > 0 && length < MAX_PATH) {
            const auto parent = std::filesystem::path(directory).parent_path().wstring();
            std::copy(parent.begin(), parent.end(), directory);
            directory[parent.size()] = L'\0';
            length = static_cast<DWORD>(parent.size());
        }
    }
    if (length == 0 || length >= MAX_PATH) {
        std::fprintf(stderr, "M6_FONT_FILE_FAILURE stage=temporary-directory length=%lu error=%lu\n", length, GetLastError());
        return 1;
    }
    // Keep generated sources in the build directory, independently of the launch directory.
    // The directory override retains the original workspace reproduction path.
    wchar_t name[MAX_PATH]{};
    if (!GetTempFileNameW(directory, L"m6f", 0, name)) {
        std::fprintf(stderr, "M6_FONT_FILE_FAILURE stage=temporary-file-create error=%lu directory=%ls\n", GetLastError(), directory);
        return 1;
    }
    const auto path = std::filesystem::absolute(name);
    std::printf("M6_FONT_FILE_START pid=%lu path=%ls\n", GetCurrentProcessId(), path.c_str());
    std::fflush(stdout);
    // Confirm the exclusive-open check detects a real outstanding reader.
    HANDLE reader = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                                OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    bool ok = reader != INVALID_HANDLE_VALUE;
    if (ok) {
        ok = !checkDirectWriteFileRelease(path) && GetLastError() == ERROR_SHARING_VIOLATION;
        if (ok && GetEnvironmentVariableW(L"CC_M6_FONT_DIAGNOSTIC_CONTROL", nullptr, 0)) {
            reportDirectWriteFileFailure(path, "intentional-held-reader-control", ERROR_SHARING_VIOLATION, true);
        }
        if (!CloseHandle(reader)) ok = false;
    }
    ok = ok && exerciseDirectWriteFile(path, fixtures[0], widths[0]) && exerciseDirectWriteFile(path, fixtures[1], widths[1]);
    std::printf("DirectWrite file replacement widths: %.6f %.6f\n", widths[0], widths[1]);
    DWORD baseline = 0;
    ok = ok && GetProcessHandleCount(GetCurrentProcess(), &baseline);
    const DWORD gdi = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    for (int i = 0; ok && i < 1000; ++i) {
        ok = exerciseDirectWriteFile(path, fixtures[i % 2], widths[i % 2]);
        if (!ok) std::fprintf(stderr, "DirectWrite source release failed at cycle %d\n", i + 1);
        if ((i + 1) % 250 == 0) {
            DWORD current = 0;
            const DWORD currentGdi = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
            ok = ok && GetProcessHandleCount(GetCurrentProcess(), &current) && current <= baseline && currentGdi == gdi;
            std::printf("DirectWrite file cycles %d handles %lu -> %lu GDI %lu -> %lu\n", i + 1, baseline, current, gdi, currentGdi);
        }
    }
    const bool removed = DeleteFileW(path.c_str()) != FALSE;
    if (!removed) reportDirectWriteFileFailure(path, "temporary-file-delete", GetLastError());
    return ok && removed ? 0 : 1;
}
#endif

void testFontAssets() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    {
        const std::string path = CC2D_FONT_FIXTURE;
        auto face = cc::DirectWriteFont::create(path, 24.F, false, false);
        check(face != nullptr, "DirectWrite loads TTF rejected by GDI");
        if (face) {
            checkNear(face->measure("Atlas 123")[0], 95.9765625F, "DirectWrite uses actual Thonburi glyph advances");
            check(face->measure("\xE0\xB9\x84\xE0\xB8\x97\xE0\xB8\xA2 A\xCC\x81")[0] > 0, "DirectWrite shapes Thai and combining marks");
            std::vector<uint8_t> raster(160 * 80 * 4);
            check(face->draw("Atlas 123", 4, 4, 0, raster.data(), 160, 80, {1, 0, 0, 1}), "DirectWrite draws custom font glyphs");
            size_t covered = 0;
            for (size_t i = 0; i < raster.size(); i += 4) {
                if (raster[i + 3]) { ++covered; check(raster[i] == 255 && raster[i + 1] == 0 && raster[i + 2] == 0, "custom glyph pixels preserve unpremultiplied color"); }
            }
            check(covered > 100 && covered < 3000, "DirectWrite glyph coverage excludes empty/full rectangle");
            std::fill(raster.begin(), raster.end(), 0);
            check(face->draw("Atlas 123", -1000, -1000, 0, raster.data(), 160, 80, {1, 0, 0, 1}), "fully clipped glyphs draw safely");
            check(std::all_of(raster.begin(), raster.end(), [](uint8_t value) { return value == 0; }), "offscreen glyphs leave destination unchanged");
            check(face->draw("Atlas 123", -80, -8, 0, raster.data(), 160, 80, {1, 0, 0, 1}), "partially clipped glyphs draw safely");
        }
        auto bold = cc::DirectWriteFont::create(path, 24.F, true, false);
        check(bold && std::fabs(bold->measure("Atlas 123")[0] - 95.9765625F) < .001F, "synthetic bold preserves font advances");
        if (bold) {
            std::vector<uint8_t> raster(160 * 80 * 4);
            check(bold->draw("Atlas 123", 4, 4, 0, raster.data(), 160, 80, {1, 1, 1, 1}), "DirectWrite synthetic bold draws shaped advances");
            check(std::any_of(raster.begin(), raster.end(), [](uint8_t value) { return value != 0; }), "synthetic bold glyph bitmap is nonempty");
            std::fill(raster.begin(), raster.end(), 0);
            check(bold->draw("Atlas 123", -1000, -1000, 0, raster.data(), 160, 80, {1, 1, 1, 1}), "fully clipped outline draw succeeds");
            check(std::all_of(raster.begin(), raster.end(), [](uint8_t value) { return value == 0; }), "fully clipped outline leaves destination unchanged");
        }
        for (const bool italic : {false, true}) {
            auto outlined = cc::DirectWriteFont::create(path, 24.F, true, italic);
            std::vector<uint8_t> full(64 * 64 * 4), clipped(32 * 24 * 4);
            check(outlined && outlined->draw("Atlas 123", 8, 32, 3, full.data(), 64, 64, {1, 1, 1, 1}), "outline reference draws");
            check(outlined && outlined->draw("Atlas 123", -8, 16, 3, clipped.data(), 32, 24, {1, 1, 1, 1}), "outline clipped viewport draws");
            for (size_t row = 0; row < 24; ++row) for (size_t column = 0; column < 32; ++column) for (size_t channel = 0; channel < 4; ++channel) {
                check(full[((row + 16) * 64 + column + 16) * 4 + channel] == clipped[(row * 32 + column) * 4 + channel],
                      "outline viewport clipping preserves offscreen filter samples");
            }
        }
        // Chrome 157 Canvas raw RGBA goldens, same Thonburi.ttf and drawing
        // parameters as test_ttf_raster.cpp. See the preblend evidence report.
        const char *samples[] = {"Atlas 123", u8"A\u0301tlas", u8"\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"};
        const uint32_t expected[2][3][4] = {
            {{970306460U, 179350236U, 1312405191U, 2526000213U},
             {68228342U, 3381704447U, 541274943U, 1846771752U},
             {2102269280U, 1921897622U, 563746039U, 2247375831U}},
            {{2502853528U, 3184567919U, 3001797215U, 2452649181U},
             {2926620246U, 4239579592U, 1097032441U, 2138942570U},
             {1926066176U, 4161798111U, 326542983U, 30686762U}},
        };
        for (size_t style = 0; style < 2; ++style) for (size_t sample = 0; sample < 3; ++sample) for (size_t index = 0; index < 4; ++index) {
            const float size = static_cast<float>((index + 1) * 12);
            auto face = cc::DirectWriteFont::create(path, size, false, style == 1);
            auto regular = cc::DirectWriteFont::create(path, size, false, false);
            check(face && regular && std::fabs(face->measure(samples[sample])[0] - regular->measure(samples[sample])[0]) < .001F,
                  "synthetic italic preserves regular shaped advances");
            std::vector<uint8_t> raster(256 * 128 * 4, 255);
            for (size_t pixel = 3; pixel < raster.size(); pixel += 4) raster[pixel] = 1;
            check(face && face->draw(samples[sample], 4.5F, size * .87F + 4, 3, raster.data(), 256, 128, {1, 1, 1, 1}), "TTF golden draw succeeds");
            uint32_t checksum = 0;
            for (uint8_t byte : raster) checksum = checksum * 31U + byte;
            check(checksum == expected[style][sample][index], "normal/italic TTF raw RGBA matches independent Web Canvas golden");
        }
        check(!cc::DirectWriteFont::create("missing-font.ttf", 24.F, false, false), "invalid custom font fails without fallback success");
    }
    std::thread staOutline([] {
        const auto initial = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        check(initial == S_OK, "outline test starts with a fresh STA lease");
        if (FAILED(initial)) return;
        {
            auto face = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 24.F, true, true);
            std::vector<uint8_t> raster(32 * 32 * 4);
            check(face && face->draw("A", 0, 24, 3, raster.data(), 32, 32, {1, 1, 1, 1}), "outline draws while borrowing an existing STA apartment");
            check(face && face->stroke("A", 0, 24, 3, raster.data(), 32, 32, {1, 0, 0, 1}, 1.5F, cc::DirectWriteFont::StrokeJoin::ROUND), "stroke borrows the same caller-owned STA apartment");
        }
        const auto retained = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        check(retained == S_FALSE, "outline draw preserves the caller STA lease");
        if (SUCCEEDED(retained)) CoUninitialize();
        CoUninitialize();
        const auto switched = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        check(switched == S_OK, "outline draw leaves no extra COM initialization lease");
        if (SUCCEEDED(switched)) CoUninitialize();
    });
    staOutline.join();
    const DWORD fontGdiBefore = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    DWORD fontHandlesBefore = 0; GetProcessHandleCount(GetCurrentProcess(), &fontHandlesBefore);
    for (int i = 0; i < 1000; ++i) {
        auto face = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 24.F, i % 2 == 0, i % 3 == 0);
        check(face && face->measure("Atlas 123")[0] > 0, "custom font collection repeated create/shape/release");
        std::array<uint8_t, 16 * 24 * 4> raster{};
        check(face && face->draw("A", 0, 20, 3, raster.data(), 16, 24, {1, 1, 1, 1}), "repeated custom font draw releases mask resources and COM leases");
        if (i % 4 == 0) check(face && face->stroke("A", 0, 20, 3, raster.data(), 16, 24, {1, 0, 0, 1}, 1.5F,
                                                cc::DirectWriteFont::StrokeJoin::ROUND), "repeated stroke releases temporary geometry and bitmap resources");
    }
    const DWORD fontGdiAfter = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    DWORD fontHandlesAfter = 0; GetProcessHandleCount(GetCurrentProcess(), &fontHandlesAfter);
    check(fontGdiBefore == fontGdiAfter, "DirectWrite font cycles retain no GDI objects");
    check(fontHandlesAfter <= fontHandlesBefore, "DirectWrite font cycles retain no process handles");
    std::printf("DirectWrite cycles: 1000, GDI objects %lu -> %lu\n", fontGdiBefore, fontGdiAfter);
    std::printf("DirectWrite handles: %lu -> %lu\n", fontHandlesBefore, fontHandlesAfter);
#endif
    cc::IntrusivePtr<cc::TTFFont> ttf(new cc::TTFFont());
    check(ttf->loadFontData(CC2D_FONT_FIXTURE), "TTF loads the font fixture");
    const auto byteCount = ttf->getFontDataSize();
    check(byteCount == std::filesystem::file_size(CC2D_FONT_FIXTURE), "TTF owns all bytes read from disk");
    check(!ttf->loadFontData("missing-font.ttf") && ttf->getFontDataSize() == byteCount
              && ttf->getSourcePath() == CC2D_FONT_FIXTURE, "TTF failed load preserves data and source");
    ttf->setFontFamily("Test Family");
    cc::IntrusivePtr<cc::LabelAtlas> font(new cc::LabelAtlas());
    const std::string config = R"({"fontDefDictionary":{"65":{"rect":{"x":0,"y":0,"width":2,"height":2},"xAdvance":2}},"kerningDict":{"4259905":-1}})";
    check(font->setConfigJson(config), "native bitmap config accepted");
    checkNear(font->getKerning(65, 65), -1, "packed kerning decoded");
    check(font->setConfigJson(R"({"kerningDict":{"-65471":-3}})"), "signed packed kerning");
    checkNear(font->getKerning(65535, 65), -3, "signed kerning key decoded");
    font->setConfigJson(config);
    const auto revision = font->getRevision();
    const auto configRevision = font->getConfigRevision();
    check(!font->setConfigJson("{bad") && font->getRevision() == revision && font->getGlyphs().size() == 1, "invalid config atomic");
    check(font->getConfigRevision() == configRevision, "failed parse preserves config revision");
    for (int kind = 0; kind < 2; ++kind) {
        cc::IntrusivePtr<cc::BitmapFontAsset> validated(kind == 0 ? new cc::BitmapFontAsset() : new cc::LabelAtlas());
        validated->setConfigJson(config);
        validated->setFontSize(24.F);
        const auto before = validated->getRevision();
        const auto configBefore = validated->getConfigRevision();
        for (float invalid : {std::numeric_limits<float>::quiet_NaN(), std::numeric_limits<float>::infinity(),
                              -std::numeric_limits<float>::infinity()}) {
            validated->setFontSize(invalid);
            check(validated->getFontSize() == 24.F && validated->getRevision() == before,
                  "nonfinite font size preserves native size and revision");
        }
        for (const auto *invalid : {
                 R"({"fontDefDictionary":{"65":{"rect":{"width":1e100}}}})",
                 R"({"fontDefDictionary":{"65":{"rect":{"width":-1}}}})",
                 R"({"fontDefDictionary":{"65":{"rect":{},"xAdvance":"2"}}})",
                 R"({"fontDefDictionary":{"65":{"rect":{}},"065":{"rect":{}}}})",
                 R"({"kerningDict":{"4294967296":1}})",
                 R"({"kerningDict":{"-2147483649":1}})",
                 R"({"kerningDict":{"9999999999999999999999999999":1}})",
                 R"({"kerningDict":{"4259905":1e100}})",
                 R"({"kerningDict":{"65":{"65":1e100}}})"}) {
            check(!validated->setConfigJson(invalid), "unsafe bitmap numeric data rejected");
            check(validated->getRevision() == before && validated->getConfigRevision() == configBefore,
                  "invalid bitmap data preserves both revisions");
            check(validated->getConfigJson() == config && validated->getGlyphs().size() == 1
                      && validated->getKerning(65, 65) == -1.F, "invalid bitmap data preserves complete native state");
        }
    }
    font->setConfigJson(config);
    check(font->getConfigRevision() == configRevision + 1, "identical config reload advances config revision");
    const auto reloadRevision = font->getConfigRevision();
    font->setFontSize(4);
    check(font->getConfigRevision() == reloadRevision, "font size does not invalidate pending config edits");
    font->clearNativeData();
    check(font->getConfigRevision() == reloadRevision + 1, "clear invalidates config views");
    check(font->setConfigJson(R"({"kerningDict":{"65":{"128512":-2}}})"), "nested Unicode kerning");
    checkNear(font->getKerning(65, 128512), -2, "Unicode kerning retained");
    font->setConfigJson(config); font->setFontSize(2);
    std::vector<uint8_t> pixels(16, 255);
    cc::IntrusivePtr<cc::ImageAsset> image(new cc::ImageAsset());
    image->setWidth(2); image->setHeight(2); image->setData(pixels.data());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->setImage(image);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    font->setSpriteFrame(frame);
    const auto frameConfigRevision = font->getConfigRevision();
    font->setSpriteFrame(frame);
    check(font->getConfigRevision() == frameConfigRevision, "atlas dependency does not invalidate config views");
    cc::Node node("font-asset"); cc::UITransform transform(&node);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    cc::Label label;
    label.setNode(&node); label.setUITransform(&transform); label.setMaterial(material);
    label.setFontSize(2); label.setLineHeight(2); label.setString("A"); label.setCacheMode(2);
    const auto refs = font->getRefCount();
    label.setFontAsset(font); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    auto *fontEntity = static_cast<cc::RenderEntity *>(node.getUserData());
    check(fontEntity->isEnabled(), "font invalidation preserves Label prepare eligibility");
    label.setEnabled(false);
    label.setFontAsset(ttf); label.setFontAsset(font);
    check(!label.isEnabled() && !fontEntity->isEnabled(), "font invalidation does not reactivate disabled Label");
    label.setEnabled(true);
    check(label.isEnabled() && fontEntity->isEnabled(), "Label re-enable restores Batcher prepare eligibility");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    const auto submitsGlyph = [&]() {
        if (fontEntity->getStaticDrawInfoSize() != 1) return false;
        auto *draw = fontEntity->getStaticRenderDrawInfo(0);
        return draw->getTexture() == texture->getGFXTexture() && draw->getVbCount() == 4 && draw->getIbCount() == 6;
    };
    check(submitsGlyph(), "LabelAtlas native glyph renders even in CHAR mode");
    const auto originalAtlas = submittedTexturePixels(fontEntity);
    label.setColorRGBA(128,64,32,128); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    node.setActiveInHierarchy(true);
    cc::Batcher2d().walk(&node, 1.F, false);
    auto *labelDraw = static_cast<cc::RenderEntity *>(node.getUserData())->getStaticRenderDrawInfo(0);
    const auto *labelVertices = labelDraw->getVDataBuffer();
    check(labelVertices != nullptr, "Label has submitted vertex data");
    if (labelVertices) {
        checkNear(labelVertices[5], 128.F / 255.F, "Bitmap glyph vertices apply RGB to the untinted source once");
        checkNear(labelVertices[6], 64.F / 255.F, "Bitmap glyph green is applied by the GPU");
        checkNear(labelVertices[8], 128.F / 255.F, "Label submitted opacity is applied once");
    }
    check(submittedTexturePixels(fontEntity) == originalAtlas, "Label texture coverage does not bake component alpha");
    label.setColorRGBA(255,255,255,255); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(label.measureUnwrappedText("A").width, label.getContentWidth(), "bitmap measurement uses native glyph table");
    check(font->getRefCount() == refs + 1, "Label retains font asset");
    { cc::Label second; second.setFontAsset(font); check(font->getRefCount() == refs + 2, "labels share font ownership"); }
    check(font->getRefCount() == refs + 1, "Label destructor releases font");
    font->setConfigJson("null"); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(fontEntity->getStaticDrawInfoSize() == 0 && label.getContentWidth() == 0, "config revision clears stale render data");
    font->setConfigJson(config); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(submitsGlyph(), "config replacement refreshes existing Label");
    font->setSpriteFrame(nullptr); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(fontEntity->getStaticDrawInfoSize() == 0, "frame detach clears Label");
    font->setSpriteFrame(frame);
    for (int i = 0; i < 1000; ++i) { label.setFontAsset(ttf); label.setFontAsset(font); label.setFontAsset(nullptr); }
    check(font->getRefCount() == refs, "repeated switching releases font ownership");
    label.setFontAsset(font); font->destroy(); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(font->isReleased() && !font->getSpriteFrame() && font->getGlyphs().empty(), "destroy releases bitmap data immediately");
    check(fontEntity->getStaticDrawInfoSize() == 0, "destroyed font clears attached Label");
    label.setFontAsset(nullptr);
    const auto frameRefs = frame->getRefCount();
    for (int kind = 0; kind < 2; ++kind) {
        for (int i = 0; i < 1000; ++i) {
            cc::IntrusivePtr<cc::BitmapFontAsset> cycle(kind == 0 ? new cc::BitmapFontAsset() : new cc::LabelAtlas());
            cycle->setConfigJson(config); cycle->setFontSize(2); cycle->setSpriteFrame(frame);
            check(frame->getRefCount() == frameRefs + 1, "bitmap font owns one atlas reference");
            label.setFontAsset(cycle); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            check(submitsGlyph(), "new font cycle renders shared atlas");
            cycle->clearNativeData(); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            check(fontEntity->getStaticDrawInfoSize() == 0 && frame->getRefCount() == frameRefs, "clear releases atlas and stale pixels");
            cycle->setConfigJson(config); cycle->setFontSize(2); cycle->setSpriteFrame(frame);
            cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            check(submitsGlyph(), "cleared font can reload native data");
            cycle->destroy(); cc::CCObject::deferredDestroy();
            const auto releasedRevision = cycle->getRevision();
            cycle->setSpriteFrame(frame); cycle->setFontSize(20); cycle->setFntDataStr("late");
            check(!cycle->setConfigJson(config), "destroyed font rejects late config");
            cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            check(cycle->getRevision() == releasedRevision && cycle->getFntDataStr().empty(), "late writes do not mutate released font");
            check(fontEntity->getStaticDrawInfoSize() == 0 && frame->getRefCount() == frameRefs, "destroyed cycle releases shared atlas");
            label.setFontAsset(nullptr);
            check(cycle->getRefCount() == 1, "Label unbind releases final consumer reference");
        }
    }
    for (int i = 0; i < 1000; ++i) {
        cc::IntrusivePtr<cc::TTFFont> cycle(new cc::TTFFont());
        check(cycle->loadFontData(CC2D_FONT_FIXTURE), "cycle loads font from disk");
        cycle->setFontFamily("Cycle Family");
        label.setFontAsset(cycle);
        check(cycle->getRefCount() == 2, "Label retains TTF during cycle");
        cycle->clearNativeData();
        check(cycle->getFontDataSize() == 0 && cycle->getFontFamily().empty(), "TTF clear releases bytes and alias");
        check(cycle->loadFontData(CC2D_FONT_FIXTURE) && cycle->getFontDataSize() == byteCount, "cleared font reloads from disk");
        cycle->setFontFamily("Reloaded Family");
        cycle->destroy(); cc::CCObject::deferredDestroy();
        const auto releasedRevision = cycle->getRevision();
        cycle->setFontFamily("Late Family");
        cycle->initDefault(ccstd::optional<ccstd::string>("late-default"));
        check(!cycle->loadFontData(CC2D_FONT_FIXTURE) && cycle->getRevision() == releasedRevision, "released TTF rejects reload");
        check(cycle->getFontDataSize() == 0 && cycle->getFontFamily().empty(), "late TTF writes cannot resurrect data");
        label.setFontAsset(nullptr);
        check(cycle->getRefCount() == 1, "Label unbind releases TTF reference");
    }
    ttf->destroy(); check(ttf->getFontDataSize() == 0 && ttf->getFontFamily().empty(), "TTF destroy releases data and alias");
    cc::CCObject::deferredDestroy();
    std::printf("font assets: PASS\n");
}

void testFontAliasOwnership() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    const auto checkWhitespace = [](const std::string &font, bool directWrite) {
        const std::string raw = "A\tB\nC\fD\rE";
        const std::string spaces = "A B C D E";
        cc::CanvasRenderingContext2D measure(192, 64);
        measure.setFont(font);
        check(measure.supportsTextStroke() == directWrite, "Canvas whitespace probe selected the expected backend");
        checkNear(measure.measureText(raw).width, measure.measureText(spaces).width, "Canvas measures controls as spaces");
        const auto verifyPixels = [&](const auto &draw, const char *message) {
            const auto raster = [&](const std::string &text) {
                cc::CanvasRenderingContext2D canvas(192, 64);
                canvas.setFont(font);
                canvas.setFillStyle("rgb(255,255,255)");
                canvas.setStrokeStyle("rgb(255,255,255)");
                canvas.setTextAlign("center");
                canvas.setTextBaseline("alphabetic");
                canvas.setLineWidth(2);
                draw(canvas, text);
                std::vector<uint8_t> pixels;
                canvas.setCanvasBufferUpdatedCallback([&](const cc::Data &data) {
                    pixels.assign(data.getBytes(), data.getBytes() + data.getSize());
                });
                canvas.fetchData();
                canvas.setCanvasBufferUpdatedCallback(nullptr);
                return pixels;
            };
            const auto reference = raster(spaces);
            check(std::any_of(reference.begin(), reference.end(), [](uint8_t value) { return value != 0; })
                      && raster(raw) == reference,
                  message);
        };
        verifyPixels([](auto &canvas, const auto &text) { canvas.fillText(text, 96, 40, 0); }, "Canvas fill treats controls as spaces");
        if (directWrite) {
            verifyPixels([](auto &canvas, const auto &text) { canvas.strokeText(text, 96, 40, 0); },
                         "Canvas stroke treats controls as spaces");
            verifyPixels([](auto &canvas, const auto &text) { canvas.fillTextShadow(text, 96, 40, 2); },
                         "Canvas shadow treats controls as spaces");
        }
    };
    {
        cc::CanvasRenderingContext2D canvas(128, 64);
        canvas.setFont("16px Arial");
        checkNear(canvas.measureText("second line").width, 80.9453125F, "system Arial preserves the fractional advance");
        const auto narrow = canvas.measureText("ii").width;
        const auto wide = canvas.measureText("WW").width;
        check(narrow > 0 && wide > narrow, "system text measurement distinguishes equal-length strings");
        canvas.resetBuffer(256, 64);
        checkNear(canvas.measureText("WW").width, wide, "resizing the bitmap preserves system font metrics");
        canvas.fillText("WW", 0, 32, 0);
        canvas.save();
        canvas.setFont("32px Arial");
        check(canvas.measureText("WW").width > wide, "font change invalidates the previous system text measurement");
        canvas.save();
        canvas.setFont("48px Arial");
        const auto largest = canvas.measureText("WW").width;
        canvas.restore();
        check(canvas.measureText("WW").width < largest && canvas.measureText("WW").width > wide,
              "nested restore selects the previous DirectWrite format");
        canvas.restore();
        checkNear(canvas.measureText("WW").width, wide, "restoring the canvas restores its prior font metrics");
        canvas.setFont("16px Arial");
        checkNear(canvas.measureText("ii").width, narrow, "restoring font and text restores the original width");
        checkWhitespace("24px Arial", true);
    }
    const auto publicBefore = getFontFamilyNameMap().size();
    const auto privateBefore = getFontAssetFamilyNameMap().size();
    const auto leasesBefore = getFontAliasLeaseCount(), groupsBefore = getFontAliasGroupCount();
    const std::string family = "M6CanvasFamilyWithMoreThanThirtyOneCharacters";
    {
        // A file can exist when its bytes cannot be registered by either backend.
        const auto lease = retainFontFamilyAlias(family, __FILE__, "M6InvalidFont");
        check(lease != 0, "invalid font fixture path is registered");
        const auto handles = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
        for (int cycle = 0; cycle < 32; ++cycle) {
            cc::CanvasRenderingContext2D canvas(32, 32);
            canvas.setFont("24px " + family);
            check(!canvas.supportsTextStroke() && canvas.measureText("A").width > 0,
                  "unreadable font face falls back to GDI");
        }
        check(handles == GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS), "failed font registration releases GDI objects");
        checkWhitespace("24px " + family, false);
        releaseFontFamilyAlias(lease);
    }
    std::puts("Canvas whitespace DirectWrite and GDI: PASS");
    // This legacy Windows bitmap font exercises the GDI-only path when installed.
    wchar_t windowsDir[MAX_PATH]{};
    const auto length = GetWindowsDirectoryW(windowsDir, MAX_PATH);
    const auto bitmapFont = std::filesystem::path(windowsDir) / L"Fonts" / L"8514fix.fon";
    if (length && length < MAX_PATH && AddFontResourceExW(bitmapFont.c_str(), FR_PRIVATE, nullptr)) {
        check(RemoveFontResourceExW(bitmapFont.c_str(), FR_PRIVATE, nullptr), "GDI control registration released");
        const auto lease = retainFontFamilyAlias(family, bitmapFont.generic_string(), "M6BitmapFont");
        check(lease != 0, "GDI bitmap font alias acquired");
        {
            cc::CanvasRenderingContext2D canvas(32, 32);
            canvas.setFont("24px " + family);
            check(!canvas.supportsTextStroke(), "bitmap font uses GDI fallback");
            const bool registered = RemoveFontResourceExW(bitmapFont.c_str(), FR_PRIVATE, nullptr) != FALSE;
            check(registered, "Canvas registered the bitmap font privately");
            if (registered) check(AddFontResourceExW(bitmapFont.c_str(), FR_PRIVATE, nullptr) > 0,
                                  "restored the Canvas-owned registration after inspecting it");
        }
        check(!RemoveFontResourceExW(bitmapFont.c_str(), FR_PRIVATE, nullptr), "Canvas destruction released its private registration");
        releaseFontFamilyAlias(lease);
        std::puts("Canvas GDI bitmap font registration exercised");
    }
    auto create = [&]() {
        cc::IntrusivePtr<cc::TTFFont> font(new cc::TTFFont());
        font->setFontFamily(family);
        check(font->loadFontData(CC2D_FONT_FIXTURE), "owned TTF loads actual font");
        return font;
    };
    {
        cc::CanvasRenderingContext2D canvas(128, 32);
        canvas.setFont("24px " + family);
        const auto fallback = canvas.measureText("Atlas 123").width;
        auto owner = create();
        const auto loaded = canvas.measureText("Atlas 123").width;
        checkNear(loaded, 95.9765625F, "existing Canvas measures newly registered font");
        check(loaded != fallback && canvas.supportsTextStroke(), "existing Canvas acquired file-backed font");
        owner->clearNativeData();
        check(!canvas.supportsTextStroke(), "existing Canvas drops released font before querying stroke support");
        checkNear(canvas.measureText("Atlas 123").width, fallback, "existing Canvas restores fallback metrics");
        cc::CanvasRenderingContext2D fill(128, 32), stroke(128, 32);
        fill.setFont("24px " + family);
        stroke.setFont("24px " + family);
        auto raster = [](cc::CanvasRenderingContext2D &ctx, bool outline) {
            ctx.resetBuffer(128, 32);
            if (outline) ctx.strokeText("Atlas 123", 2, 24, 0);
            else ctx.fillText("Atlas 123", 2, 24, 0);
            std::vector<uint8_t> bytes;
            ctx.setCanvasBufferUpdatedCallback([&](const cc::Data &data) {
                bytes.assign(data.getBytes(), data.getBytes() + data.getSize());
            });
            ctx.fetchData();
            ctx.setCanvasBufferUpdatedCallback(nullptr);
            return bytes;
        };
        const auto fallbackFill = raster(fill, false), fallbackStroke = raster(stroke, true);
        owner = create();
        cc::CanvasRenderingContext2D fresh(128, 32);
        fresh.setFont("24px " + family);
        const auto fileFill = raster(fresh, false), fileStroke = raster(fresh, true);
        check(fileFill != fallbackFill && fileStroke != fallbackStroke, "Canvas file font has distinct fill and stroke masks");
        check(raster(fill, false) == fileFill && raster(stroke, true) == fileStroke, "first draw after font load uses new face");
        checkNear(canvas.measureText("Atlas 123").width, loaded, "existing Canvas selects reloaded font");
        cc::IntrusivePtr<cc::TTFFont> replacement(new cc::TTFFont());
        replacement->setFontFamily(family);
        check(replacement->loadFontData(CC2D_REPLACEMENT_FONT), "second font binds to the same Canvas family");
        const auto replaced = canvas.measureText("Atlas 123").width;
        cc::CanvasRenderingContext2D direct(128, 32);
        direct.setFont("24px " + replacement->getRenderFontFamily());
        check(replaced != loaded && replaced == direct.measureText("Atlas 123").width,
              "existing Canvas selects replacement font metrics");
        replacement->clearNativeData();
        checkNear(canvas.measureText("Atlas 123").width, loaded, "releasing replacement restores older font face");
        owner->clearNativeData();
        check(raster(fill, false) == fallbackFill && raster(stroke, true) == fallbackStroke, "first draw after release uses fallback");
        std::printf("Canvas alias widths: fallback %.8f, file %.8f, replacement %.8f\n", fallback, loaded, replaced);
    }
    for (int iteration = 0; iteration < 1000; ++iteration) {
        auto first = create(), second = create();
        const auto firstRender = first->getRenderFontFamily(), secondRender = second->getRenderFontFamily();
        check(firstRender != secondRender && firstRender != family, "font assets have independent render identities");
        check(getFontFamilyNameMap().size() == publicBefore + 1 && getFontAssetFamilyNameMap().size() == privateBefore + 2,
              "shared alias has one public record and two owned render records");
        if (iteration == 0) {
            cc::Label label;
            label.setFontAsset(first); label.setFontSize(24);
            checkNear(label.measureUnwrappedText("Atlas 123").width, 95.9765625F,
                      "native Label selects owned font without a JS font registration");
            const auto revision = first->getRevision();
            check(!first->loadFontData("missing-font.ttf") && first->getRevision() == revision
                      && first->getRenderFontFamily() == firstRender, "failed font load preserves alias lease");
            label.setFontAsset(nullptr);
        }
        first->destroy();
        check(getFontFamilyNameMap().count(family) == 1 && !getFontAssetFamilyNameMap().count(firstRender)
                  && getFontAssetFamilyNameMap().count(secondRender) == 1, "destroying one shared font preserves its peer");
        second->clearNativeData();
        check(getFontFamilyNameMap().size() == publicBefore && getFontAssetFamilyNameMap().size() == privateBefore,
              "last owner releases public and private font aliases");
        check(getFontAliasLeaseCount() == leasesBefore && getFontAliasGroupCount() == groupsBefore,
              "last owner releases lease and generation records");
        first->setFontFamily(family); first->loadFontData(CC2D_FONT_FIXTURE);
        check(getFontFamilyNameMap().size() == publicBefore, "released font cannot recreate alias ownership");
        second->setFontFamily(family); second->loadFontData(CC2D_FONT_FIXTURE);
        // second's C++ destructor, without explicit destroy, must release its lease.
    }
    check(getFontFamilyNameMap().size() == publicBefore && getFontAssetFamilyNameMap().size() == privateBefore,
          "TTF C++ destruction releases font aliases");
    std::printf("font alias ownership: 1000 shared create/destroy/clear/reload cycles PASS\n");
#endif
}

void testTextShadowCrop() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    constexpr size_t HEIGHT = 32, CLIPPED_WIDTH = 32, FULL_WIDTH = 64;
    constexpr std::array<float, 4> GREEN{0, 1, 0, 0.5F};
    for (const bool bold : {false, true}) {
        const auto face = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 24, bold, false);
        check(face != nullptr, "shadow crop font loads");
        if (!face) continue;
        std::vector<uint8_t> hard(CLIPPED_WIDTH * HEIGHT * 4);
        check(face->draw("I", 32, 28, 3, hard.data(), CLIPPED_WIDTH, HEIGHT, GREEN), "hard shadow crop draws");
        check(std::all_of(hard.begin(), hard.end(), [](uint8_t value) { return value == 0; }), "source glyph is outside the viewport");
        for (const float blur : {4.F, 8.F}) {
            std::vector<uint8_t> full(FULL_WIDTH * HEIGHT * 4), cropped(CLIPPED_WIDTH * HEIGHT * 4);
            check(face->drawShadow("I", 32, 28, 3, full.data(), FULL_WIDTH, HEIGHT, GREEN, blur), "full shadow draws");
            check(face->drawShadow("I", 32, 28, 3, cropped.data(), CLIPPED_WIDTH, HEIGHT, GREEN, blur), "cropped shadow draws");
            check(std::any_of(cropped.begin(), cropped.end(), [](uint8_t value) { return value != 0; }),
                  "cropped texture retains shadow cast by an off-canvas glyph");
            bool matches = true;
            for (size_t row = 0; row < HEIGHT; ++row) {
                const auto begin = cropped.begin() + row * CLIPPED_WIDTH * 4;
                matches &= std::equal(begin, begin + CLIPPED_WIDTH * 4, full.begin() + row * FULL_WIDTH * 4);
            }
            check(matches, "cropping a shadow preserves its convolution samples");
        }
    }

    cc::CanvasRenderingContext2D canvas(96, 64);
    canvas.setFont("24px Arial");
    canvas.setFillStyle("#0000ff");
    const auto draw = [&canvas]() {
        std::vector<uint8_t> pixels;
        canvas.resetBuffer(96, 64);
        canvas.setCanvasBufferUpdatedCallback([&pixels](const cc::Data &data) {
            pixels.assign(data.getBytes(), data.getBytes() + data.getSize());
        });
        canvas.fillText("I", 20, 32, 0);
        canvas.fetchData();
        canvas.setCanvasBufferUpdatedCallback(nullptr);
        return pixels;
    };
    const auto countGreen = [](const auto &pixels) {
        size_t count = 0;
        for (size_t i = 0; i + 3 < pixels.size(); i += 4) {
            if (pixels[i + 1] > 0 && pixels[i + 3] > 0) ++count;
        }
        return count;
    };
    const auto plain = draw();
    check(!plain.empty() && countGreen(plain) == 0, "Canvas text starts with a transparent shadow");
    canvas.setShadowColor("rgba(0, 255, 0, 0.5)");
    canvas.setShadowOffsetX(24);
    canvas.setShadowOffsetY(8);
    const auto hard = draw();
    const size_t hardCoverage = countGreen(hard);
    check(hardCoverage > 0, "Canvas fillText uses the hard shadow offset and color");
    canvas.save();
    canvas.setShadowBlur(4);
    canvas.setShadowOffsetY(-8);
    check(countGreen(draw()) > hardCoverage, "Canvas fillText blurs the shadow mask");
    canvas.restore();
    check(draw() == hard, "Canvas restore restores the text shadow settings");
    canvas.setShadowColor("transparent");
    check(draw() == plain, "Transparent shadow color restores the unshadowed text pixels");
#endif
}

void testTextStroke() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    cc::CanvasRenderingContext2D fallback(16, 16); fallback.setFont("24px M6UnavailableCanvasFamily");
    check(!fallback.supportsTextStroke(), "GDI font does not advertise unsupported outline stroke");
    auto bold = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 48, true, false);
    std::vector<uint8_t> stem(64 * 64 * 4, 255);
    for (size_t i = 3; i < stem.size(); i += 4) stem[i] = 1;
    check(bold && bold->draw("I", 8, 50, 3, stem.data(), 64, 64, {1, 1, 1, 1}), "synthetic bold stem draws");
    // The upper edge covers 1/16 pixel at this size. The Web Canvas fixture
    // includes the alpha-1 background and the horizontal glyph mask filter.
    check(stem[(18 * 64 + 11) * 4 + 3] == 70 && stem[(19 * 64 + 11) * 4 + 3] == 255,
          "axis-aligned bold fill preserves partial top-edge coverage");
    auto face = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 96, false, false);
    std::vector<uint8_t> fill(128 * 128 * 4), narrow(fill.size()), wide(fill.size());
    check(face && face->draw("H", 10, 110, 3, fill.data(), 128, 128, {1, 1, 1, 1}), "stroke interior reference draws");
    check(face && face->stroke("H", 10, 110, 3, narrow.data(), 128, 128, {1, 1, 1, 1}, 1,
                             cc::DirectWriteFont::StrokeJoin::ROUND), "thin hollow glyph stroke draws");
    check(face && face->stroke("H", 10, 110, 3, wide.data(), 128, 128, {1, 1, 1, 1}, 5,
                             cc::DirectWriteFont::StrokeJoin::ROUND), "wide hollow glyph stroke draws");
    size_t interiors = 0, narrowCount = 0, wideCount = 0;
    for (size_t i = 3; i < narrow.size(); i += 4) { if (narrow[i]) ++narrowCount; if (wide[i]) ++wideCount; }
    for (int row = 2; row < 126; ++row) for (int column = 2; column < 126; ++column) {
        bool interior = true;
        for (int dy = -2; dy <= 2; ++dy) for (int dx = -2; dx <= 2; ++dx)
            if (fill[((row + dy) * 128 + column + dx) * 4 + 3] != 255) interior = false;
        if (interior) { ++interiors; check(narrow[(row * 128 + column) * 4 + 3] == 0, "stroke leaves glyph interior unfilled"); }
    }
    check(interiors > 0 && narrowCount > 0 && wideCount > narrowCount, "stroke preserves hollow interior and responds to line width");
    std::vector<uint8_t> invalid(fill.size());
    for (const float width : {0.F, -1.F, std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN()}) {
        check(face && !face->stroke("H", 10, 110, 3, invalid.data(), 128, 128, {1, 1, 1, 1}, width), "invalid stroke width rejected");
    }
    check(std::all_of(invalid.begin(), invalid.end(), [](uint8_t value) { return value == 0; }), "invalid stroke does not mutate pixels");
    auto joined = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 48, true, true);
    std::vector<uint8_t> round(fill.size()), bevel(fill.size());
    check(joined && joined->stroke("M", 10, 90, 3, round.data(), 128, 128, {1, 1, 1, 1}, 8,
                                 cc::DirectWriteFont::StrokeJoin::ROUND), "round bold italic stroke draws");
    check(joined && joined->stroke("M", 10, 90, 3, bevel.data(), 128, 128, {1, 1, 1, 1}, 8,
                                 cc::DirectWriteFont::StrokeJoin::BEVEL), "bevel bold italic stroke draws");
    check(round != bevel, "glyph stroke honors line joins");
    std::vector<uint8_t> full(64 * 64 * 4), clipped(32 * 24 * 4);
    auto cropFace = cc::DirectWriteFont::create(CC2D_FONT_FIXTURE, 24, true, true);
    check(cropFace && cropFace->stroke("Atlas 123", 8, 32, 3, full.data(), 64, 64, {1, 1, 1, 1}, 3), "stroke crop reference draws");
    check(cropFace && cropFace->stroke("Atlas 123", -8, 16, 3, clipped.data(), 32, 24, {1, 1, 1, 1}, 3), "stroke viewport crop draws");
    for (size_t row = 0; row < 24; ++row) for (size_t column = 0; column < 32; ++column) for (size_t channel = 0; channel < 4; ++channel)
        check(full[((row + 16) * 64 + column + 16) * 4 + channel] == clipped[(row * 32 + column) * 4 + channel], "stroke clipping preserves filter samples");
    std::printf("native text stroke: PASS\n");
#endif
}

void testLabelStyleExtents() {
    cc::Node node("label-style-extents"); cc::UITransform ui(&node);
    cc::Label label; label.setNode(&node); label.setUITransform(&ui);
    label.setFontSize(24); label.setLineHeight(30); label.setEnableWrapText(false); label.setString("Atlas 123");
    cc::CanvasRenderingContext2D raw(1, 1); raw.setFont("italic 24px Arial");
    const float italicGlyphWidth = raw.measureText("Atlas 123").width;
    label.setIsItalic(true);
    const auto italic = label.measureUnwrappedText("Atlas 123");
    checkNear(italic.width - italicGlyphWidth, 5.101357474F, "TTF italic reserves Web 12-degree overhang");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(label.getContentWidth(), italic.width, "italic Label raster layout agrees with RichText measurement");
    const double expectedAdvance = italicGlyphWidth + 24.0 * std::tan(12 * 0.0174532925);
    check(std::abs(label.getTTFContentWidth() - expectedAdvance) < 1e-9,
          "TTF contentWidth preserves the fractional italic advance for subsequent segments");
    label.setEnableOutline(true); label.setOutlineWidth(2);
    const auto combined = label.measureUnwrappedText("Atlas 123");
    checkNear(combined.width - italic.width, 4.F, "outline extends both horizontal edges");
    checkNear(combined.height - italic.height, 4.F, "outline extends both vertical edges");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(label.getContentWidth(), combined.width, "outlined Label width agrees with measurement");
    checkNear(label.getContentHeight(), combined.height, "outlined Label height agrees with measurement");
    for (float width : {2.F + 1.F / 128, 2.F, 2.F - 1.F / 128, 2.F}) {
        label.setOutlineWidth(width);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(label.getContentWidth(), italic.width + 2.F * width, "fractional outline changes both edge extents");
    }
    label.setEnableOutline(false); label.setIsItalic(false); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(label.getContentWidth(), label.measureUnwrappedText("Atlas 123").width, "style removal clears previous extent");
    label.setEnableWrapText(true);
    for (int i = 0; i < 3; ++i) {
        label.setEnableOutline(true); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(label.getContentWidth(), label.measureUnwrappedText("Atlas 123").width, "auto width does not accumulate outline extent");
        label.setEnableOutline(false); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    }
    label.setString("A"); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(label.getContentWidth(), label.measureUnwrappedText("A").width, "Overflow NONE shrinks with wrap flag enabled");
    label.setEnableWrapText(false);
    label.setOverflow(2);
    label.setEnableShadow(true);
    label.setShadowOffset(0.F, 0.F);
    ui.setContentSize(label.measureUnwrappedText("A").width + 4.F + 1.F / 128, 100.F);
    for (float blur : {2.F, 2.F + 1.F / 128, 2.F, 2.F - 1.F / 128, 2.F}) {
        label.setShadowBlur(blur);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(label.getActualFontSize(), blur > 2.F ? 23.F : 24.F, "fractional blur crosses the unwrapped SHRINK boundary");
    }
    label.setEnableShadow(false);
    label.setString("MMMM");
    const float width = label.measureUnwrappedText("MMMM").width;
    constexpr float STEP = 1.F / 2048;
    for (float offset : {STEP, -STEP, STEP}) {
        ui.setContentSize(width + offset, 100.F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(label.getActualFontSize(), offset < 0 ? 23.F : 24.F, "container width crossing SHRINK boundary");
    }
    label.setOverflow(3); label.setEnableWrapText(true);
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    const float singleHeight = ui.getContentSize().y;
    for (float offset : {-STEP, STEP}) {
        ui.setContentSize(width + offset, ui.getContentSize().y);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(ui.getContentSize().y, singleHeight + (offset < 0 ? 30.F : 0.F), "container width crossing wrap boundary");
    }
    label.setLineHeight(30.F + STEP);
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    checkNear(ui.getContentSize().y, label.getContentHeight(), "RESIZE_HEIGHT publishes the fractional height");
    std::printf("label style extents: PASS\n");
}

void testLabelRasterMapping() {
    cc::Node node("label-raster-mapping"); cc::UITransform ui(&node);
    cc::Label label; label.setNode(&node); label.setUITransform(&ui);
    cc::IntrusivePtr<cc::Material> material(new cc::Material()); label.setMaterial(material);
    label.setFontSize(24); label.setLineHeight(30); label.setString("Atlas 123");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    const auto width = static_cast<uint32_t>(label.getContentWidth());
    const auto height = static_cast<uint32_t>(label.getContentHeight());
    auto *entity = static_cast<cc::RenderEntity *>(node.getUserData());
    auto *texture = entity->getStaticRenderDrawInfo(0)->getTexture();
    check(texture && texture->getWidth() == width && texture->getHeight() == height, "Submitted TTF texture uses Web integer canvas dimensions");
    auto *sampler = entity->getStaticRenderDrawInfo(0)->getSampler();
    check(sampler && sampler->getInfo().addressU == cc::gfx::Address::CLAMP && sampler->getInfo().addressV == cc::gfx::Address::CLAMP, "TTF sampler clamps canvas borders like Web");
    cc::CanvasRenderingContext2D reference(static_cast<float>(width), static_cast<float>(height));
    reference.setFont("24px Arial"); reference.setTextBaseline("alphabetic"); reference.setTextAlign("left");
    reference.setFillStyle("rgba(255,255,255,0.004)"); reference.fillRect(0, 0, static_cast<float>(width), static_cast<float>(height));
    reference.setFillStyle("rgb(255,255,255)"); reference.fillText("Atlas 123", 0, 20.88F, 0);
    std::vector<uint8_t> expectedAlpha;
    uint32_t covered = 0;
    reference.setCanvasBufferUpdatedCallback([&](const cc::Data &data) {
        for (uint32_t i = 3; i < data.getSize(); i += 4) {
            expectedAlpha.push_back(data.getBytes()[i]);
            if (data.getBytes()[i] > 1) ++covered;
        }
    });
    reference.fetchData();
    const auto rgba = submittedTexturePixels(entity);
    std::vector<uint8_t> actualAlpha;
    for (size_t i = 3; i < rgba.size(); i += 4) actualAlpha.push_back(rgba[i]);
    check(actualAlpha == expectedAlpha, "TTF raster follows Web alphabetic baseline and edge prefill");
    check(countLabelCoverage(label) == covered, "TTF glyph coverage excludes invisible edge prefill");
    label.setString(" "); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(countLabelCoverage(label) == 0, "whitespace prefill is not counted as visible text");
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    label.setOverflow(1);
    label.setEnableWrapText(false);
    ui.setContentSize(96, 40);
    label.setString("Atlas 123");
    label.updateRenderData(true);
    const auto originalPixels = submittedTexturePixels(entity);
    const auto handlesBeforeRedraw = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    bool redrawMatches = true;
    for (int i = 0; i < 128; ++i) {
        ui.setContentSize(i % 2 ? 96 : 120, 40);
        label.setString(" ");
        label.updateRenderData(true);
        redrawMatches &= countLabelCoverage(label) == 0;
        ui.setContentSize(96, 40);
        label.setString("Atlas 123");
        label.updateRenderData(true);
        redrawMatches &= submittedTexturePixels(entity) == originalPixels;
    }
    check(redrawMatches, "cached Windows font redraws same-size and resized surfaces without stale glyphs");
    check(GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS) == handlesBeforeRedraw,
          "reusing the font DC across redraws releases its raster bitmaps");
    {
        cc::CanvasRenderingContext2D background(3, 1);
        background.setFillStyle("rgba(23,77,138,0.004)");
        background.fillRect(0, 0, 2, 1);
        background.setFillStyle("rgb(41,87,149)");
        background.fillRect(1, 0, 1, 1);
        background.setCanvasBufferUpdatedCallback([](const cc::Data &data) {
            const std::array<uint8_t, 12> expected{23, 77, 138, 1, 41, 87, 149, 255, 0, 0, 0, 0};
            check(data.getSize() == expected.size() && std::equal(expected.begin(), expected.end(), data.getBytes()),
                  "Canvas background retains straight RGBA on transparent pixels and opaque overwrite");
        });
        background.fetchData();
        cc::CanvasRenderingContext2D fractional(4, 4);
        fractional.setFillStyle("rgb(255,0,0)");
        uint8_t expected = 64;
        fractional.setCanvasBufferUpdatedCallback([&](const cc::Data &data) {
            for (uint32_t y = 0; y < 4; ++y) for (uint32_t x = 0; x < 4; ++x) {
                const auto offset = (y * 4 + x) * 4;
                check(data.getBytes()[offset + 3] == (x < 2 && y < 2 ? expected : 0), "fractional Canvas rect coverage and source-over");
            }
        });
        fractional.fillRect(.5F, .5F, 1, 1); fractional.fetchData();
        expected = 112; fractional.fillRect(.5F, .5F, 1, 1); fractional.fetchData();
        cc::CanvasRenderingContext2D clipped(4, 4); clipped.setFillStyle("rgb(255,0,0)");
        clipped.setCanvasBufferUpdatedCallback([&](const cc::Data &data) {
            check(data.getBytes()[3] == 64, "negative Canvas rect clips fractional coverage");
            for (uint32_t i = 7; i < data.getSize(); i += 4) check(data.getBytes()[i] == 0, "clipped Canvas rect does not write outside destination");
        });
        clipped.fillRect(.5F, .5F, -1.5F, -1.5F); clipped.fetchData();
    }
    const DWORD before = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    for (int i = 0; i < 1000; ++i) {
        cc::CanvasRenderingContext2D canvas(8, 8); canvas.setFont("14px Arial");
        canvas.measureText("A"); canvas.setFillStyle("white"); canvas.fillRect(.5F, .5F, 1, 1);
    }
    const DWORD after = GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS);
    check(before == after, "Canvas context cycles release GDI objects");
    std::printf("Canvas GDI cycles: %lu -> %lu\n", before, after);
#endif
    std::printf("label raster mapping: PASS\n");
}

void testCharLabelRasterReuse() {
    cc::Node node("char-label-raster-reuse");
    cc::UITransform transform(&node);
    cc::Label label;
    label.setNode(&node);
    label.setUITransform(&transform);
    cc::IntrusivePtr<cc::Material> material(new cc::Material());
    label.setMaterial(material);
    label.setCacheMode(2);
    label.setFontSize(16);
    label.setLineHeight(20);
    auto *entity = label.getRenderEntity();
    label.setString("AB");
    const auto before = submittedTexturePixels(entity);
    if (before.empty()) return;
    const auto *texture = entity->getStaticRenderDrawInfo(0)->getTexture();
    const auto initialId = texture->getObjectID();
    const auto initialWidth = texture->getWidth();
    label.setString("BA");
    const auto after = submittedTexturePixels(entity);
    if (after.empty()) return;
    texture = entity->getStaticRenderDrawInfo(0)->getTexture();
    check(texture && texture->getObjectID() == initialId && texture->getWidth() == initialWidth
              && after.size() == before.size() && after != before && countLabelCoverage(label) > 0,
          "Equal-size CHAR redraw uploads new pixels to the same GPU texture");
    label.setString("A longer string");
    const auto resized = submittedTexturePixels(entity);
    if (resized.empty()) return;
    texture = entity->getStaticRenderDrawInfo(0)->getTexture();
    check(texture && texture->getObjectID() != initialId && texture->getWidth() != initialWidth
              && resized.size() != after.size() && countLabelCoverage(label) > 0,
          "Resized CHAR redraw reallocates and uploads visible glyphs");
}

void testRichTextParser() {
    const auto spans = cc::RichTextParser::parse("<color=red>A<size=0>B</size><b click=\"tap\" param=\"arg\">C</b><img src=\"icon\" width=16 height=20/>D</color>");
    check(spans.size() == 5, "RichText emits text and image spans");
    if (spans.size() == 5) {
        check(spans[0].style && spans[0].style->color == "red", "RichText native color");
        check(spans[1].style && spans[1].style->size == 0 && spans[1].style->color == "red", "RichText zero property survives absent parent property");
        check(spans[2].style && spans[2].style->bold && spans[2].style->event
              && spans[2].style->event->at("click") == "tap" && spans[2].style->event->at("param") == "arg", "RichText native click metadata");
        check(spans[3].style && spans[3].style->isImage && spans[3].style->src == "icon"
              && spans[3].style->imageWidth == 16 && !spans[3].style->color, "RichText image attributes have Web inheritance boundary");
    }
    const auto inherited = cc::RichTextParser::parse("<size=24><size=0>x</size></size>");
    check(inherited.size() == 1 && inherited[0].style && inherited[0].style->size == 24, "RichText falsy child inherits present parent property");
    const auto tail = cc::RichTextParser::parse("<b>tail");
    check(tail.size() == 1 && !tail[0].style, "RichText preserves Web unclosed-tail behavior");
    const auto entities = cc::RichTextParser::parse("&amp;lt;&lt;&quot;&apos;");
    check(entities.size() == 1 && entities[0].text == "&lt;<\"'", "RichText entity replacement order");
    for (int i = 0; i < 1000; ++i) {
        const auto text = cc::RichTextParser::parse(i % 2 ? "<b>x</b>" : "");
        check(text.size() == (i % 2 ? 1U : 0U), "RichText parser calls retain no previous spans");
    }
    std::printf("rich text parser: PASS\n");
}

void testRichTextLayout() {
    const auto spans = cc::RichTextParser::parse("<b>ab</b><img src=\"icon\"/><br/>end");
    cc::RichTextLayoutOptions options;
    options.fontSize = 20; options.lineHeight = 24; options.maxWidth = 80;
    options.anchorX = 0; options.anchorY = 0;
    std::map<std::pair<size_t, std::string>, int> calls;
    const auto result = cc::RichTextLayout::build(spans, options, [&](size_t index, const std::string &text) {
        ++calls[{index, text}]; return cc::RichTextExtent{static_cast<double>(text.size()) * 10, 30.24};
    }, [](const std::string &name) -> std::optional<cc::RichTextExtent> {
        return name == "icon" ? std::make_optional(cc::RichTextExtent{20, 10}) : std::nullopt;
    });
    check(result.placements.size() == 3 && result.lineCount == 2, "RichText native layout creates line placements");
    checkNear(result.width, 80, "RichText max width"); checkNear(result.height, 54.24F, "RichText baseline content height");
    if (result.placements.size() == 3) {
        checkNear(result.placements[1].x, 20, "RichText inline image offset");
        checkNear(result.placements[1].y, 27.12F, "RichText image baseline");
        check(result.placements[2].text == "end" && result.placements[2].line == 2, "RichText explicit line break");
    }
    check(calls[{0, "ab"}] == 1, "RichText memoizes stable measurements within one layout");
    std::printf("rich text layout: PASS\n");
}

void testLabelEntityColor() {
    const int failuresBefore = gFailures;
    cc::Node node("label-legacy-entity-color"); cc::UITransform ui(&node);
    cc::Label label; label.setNode(&node); label.setUITransform(&ui);
    label.setFontSize(12); label.setLineHeight(16); label.setString("A");
    cc::IntrusivePtr<cc::TTFFont> ttf(new cc::TTFFont()); ttf->setFontFamily("Arial");
    cc::IntrusivePtr<cc::BitmapFontAsset> bitmap(new cc::BitmapFontAsset());
    cc::IntrusivePtr<cc::LabelAtlas> atlas(new cc::LabelAtlas());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->create(2, 2);
    auto frame = makeSquareFrame(texture, 2);
    for (auto *font : {bitmap.get(), static_cast<cc::BitmapFontAsset *>(atlas.get())}) {
        font->setFontSize(2); font->setSpriteFrame(frame);
        font->setConfigJson(R"({"fontDefDictionary":{"65":{"rect":{"x":0,"y":0,"width":2,"height":2},"xAdvance":2}}})");
    }
    auto &manager = cc::UIRendererManager::getInstance();
    for (auto *font : {static_cast<cc::FontAsset *>(nullptr), static_cast<cc::FontAsset *>(ttf.get()),
                       static_cast<cc::FontAsset *>(bitmap.get()), static_cast<cc::FontAsset *>(atlas.get())}) {
        label.setFontAsset(font); label.setColorRGBA(100, 80, 60, 200); label.updateRenderData();
        const bool isBitmap = dynamic_cast<cc::BitmapFontAsset *>(font) != nullptr;
        for (const auto alpha : {0, 78, 255}) {
            label.setEntityColorRGBA(12, 34, 56, static_cast<float>(alpha));
            manager.updateAllDirtyRenderers();
            const auto color = label.getRenderEntity()->getColor();
            check(color.r == (isBitmap ? 12 : 255) && color.g == (isBitmap ? 34 : 255)
                      && color.b == (isBitmap ? 56 : 255) && color.a == alpha,
                  "legacy Label entity tint reaches the actual native render entity");
        }
        // A later rebuild must still rasterize/tint with the component color.
        label.setString("AA"); label.updateRenderData(); manager.updateAllDirtyRenderers();
        const auto restored = label.getRenderEntity()->getColor();
        check(restored.r == (isBitmap ? 100 : 255) && restored.g == (isBitmap ? 80 : 255)
                  && restored.b == (isBitmap ? 60 : 255) && restored.a == 200,
              "legacy entity tint preserves the Label color used by the next rebuild");
        label.setString("A");
    }
    std::printf("label legacy entity color: %s (4 font paths, 3 alpha values)\n", failuresBefore == gFailures ? "PASS" : "FAIL");
}

void testRichTextRuntime() {
    cc::Node node("native-rich-text"); cc::UITransform ui(&node); ui.setAnchorPoint(0.F, 0.F);
    cc::Sprite parentRenderer; parentRenderer.setNode(&node);
    auto *parentEntity = node.getUserData();
    cc::IntrusivePtr<cc::SpriteAtlas> atlas(new cc::SpriteAtlas());
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->create(4,2);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    atlas->addSpriteFrame("icon", frame);
    const auto frameRefs = frame->getRefCount();
    cc::IntrusivePtr<cc::TTFFont> font(new cc::TTFFont()); font->setFontFamily("Arial");
    const auto fontRefs = font->getRefCount();
    cc::RichText rich;
    rich.setFontSize(16); rich.setLineHeight(20); rich.setImageAtlas(atlas); rich.setFontAsset(font);
    rich.setString("<b click=\"tap\" param=\"hello\">one</b><img src=\"icon\" width=12 height=10/><br/>two");
    rich.setNode(&node); rich.setUITransform(&ui);
    check(node.getUserData() == parentEntity, "RichText group preserves an existing parent renderer");
    check(node.getChildren().size() == 3, "native RichText owns native segment children");
    auto *segmentEntity = static_cast<cc::RenderEntity *>(node.getChildren()[0]->getUserData());
    check(segmentEntity->isEnabled(), "RichText font segment remains eligible for Batcher prepare");
    if (segmentEntity->isEnabled()) cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(countLabelCoverage(*getChildRenderer<cc::Label>(node, 0)) > 0, "Batcher prepare renders native RichText font segment");
    check(getChildRenderer<cc::Label>(node, 0) && getChildRenderer<cc::Sprite>(node, 1) && getChildRenderer<cc::Label>(node, 2), "native RichText creates Label and Sprite segments");
    check((node.getChildren()[0]->getHideFlags() & cc::CCObject::Flags::DONT_SAVE) != cc::CCObject::Flags::ZERO, "RichText generated children are not serialized");
    check(frame->getRefCount() > frameRefs && font->getRefCount() > fontRefs, "RichText segments retain native assets");
    se::Value imageLayout;
    auto *transform = getChildRenderer<cc::Sprite>(node, 1)->getUITransform();
    const bool hasWrapper = transform && nativevalue_to_se(transform, imageLayout, nullptr) && imageLayout.isObject();
    check(hasWrapper, "wrap the image segment layout");
    auto *first = node.getChildren()[0].get();
    getChildRenderer<cc::Label>(node, 0)->setString("idle marker");
    for (int i = 0; i < 1000; ++i) cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(node.getChildren()[0].get() == first && getChildRenderer<cc::Label>(node, 0)->getString() == "idle marker", "idle RichText preserves segment identity and content");
    getChildRenderer<cc::Label>(node, 0)->setString("one");
    for (uint32_t i = 0; i < node.getChildren().size(); ++i) {
        auto *entity = static_cast<cc::RenderEntity *>(node.getChildren()[i]->getUserData());
        check(entity != nullptr, "native RichText child has renderer");
        if (entity) { cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); check(entity->getStaticDrawInfoSize() > 0, "native RichText submits segment draw info"); }
    }
    auto *imageEntity = getChildRenderer<cc::Sprite>(node, 1)->getRenderEntity();
    auto *imageDraw = imageEntity->getStaticDrawInfoSize() ? imageEntity->getRenderDrawInfoAt(0) : nullptr;
    check(imageDraw && imageDraw->getVbCount() == 16 && imageDraw->getIbCount() == 54,
          "native RichText image submits a nine-slice mesh");
    if (getChildRenderer<cc::Label>(node, 0)) {
        const auto measured = getChildRenderer<cc::Label>(node, 0)->measureUnwrappedText("one");
        checkNear(measured.width, getChildRenderer<cc::Label>(node, 0)->getContentWidth(), "RichText measurement agrees with Label output");
        check(countLabelCoverage(*getChildRenderer<cc::Label>(node, 0)) > 0, "RichText text raster is visible");
    }
    check(rich.getSegmentClickHandler(0) == "tap" && rich.getSegmentClickParam(0) == "hello", "native RichText stores click metadata");
    const auto &placement = rich.getLayout().placements[0];
    const auto hits = rich.getHitSegments(static_cast<float>(placement.x + placement.width / 2), static_cast<float>(placement.y + placement.height / 2));
    check(hits.size() == 1 && hits[0] == 0 && rich.getHitSegments(-1000,-1000).empty(), "native RichText hit and miss use segment geometry");
    rich.setEnabled(false); check(!first->isActive() && rich.getHitSegments(1,1).empty(), "disabled RichText hides children and ignores hits");
    rich.setString("changed");
    check(node.getChildren().size() == 3 && getChildRenderer<cc::Label>(node, 0)->getString() == "one", "disabled RichText defers layout");
    rich.setEnabled(true);
    check(node.getChildren().size() == 1 && node.getChildren()[0].get() == first && getChildRenderer<cc::Label>(node, 0)->getString() == "changed", "enabling RichText applies the deferred text to the reused segment");
    cc::IntrusivePtr<cc::Node> retiredNode(node.getChildren()[0]);
    if (hasWrapper) check(imageLayout.toObject()->getPrivateData() == transform, "pooled image layout wrapper stays valid");
    check(frame->getRefCount() == frameRefs, "recycled image releases frame and texture references");
    rich.setFontAsset(nullptr); check(font->getRefCount() == fontRefs, "RichText clears font references including measurement cache");
    rich.setString("<img src=\"icon\"/>");
    const auto imageWidth = rich.getLayout().placements[0].width;
    getChildRenderer<cc::Sprite>(node, 0)->setSharedMaterial(nullptr, 0);
    node.setActiveInHierarchy(true);
    cc::Batcher2d batcher;
    frame->setRectWidth(2); cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); batcher.walk(&node, 1.F, false);
    check(rich.getLayout().placements[0].width < imageWidth, "RichText follows native frame revision");
    atlas->removeSpriteFrame("icon"); cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); batcher.walk(&node, 1.F, false);
    check(node.getChildren().empty(), "RichText follows atlas table revision");
    rich.setString("final"); rich.setNode(nullptr); rich.setImageAtlas(nullptr);
    check(node.getChildren().empty(), "RichText detach releases active and pooled native children");
    check(!cc::isObjectValid(retiredNode.get()) && !retiredNode->getParent() && !retiredNode->isActive(),
          "RichText retires a segment Node even while an external owner keeps it alive");
    if (hasWrapper) check(!imageLayout.toObject()->getPrivateData(), "detaching RichText invalidates the borrowed layout wrapper");
    cc::Node lateNode("rich-text-late-transform"); cc::RichText late;
    late.setString("late"); late.setNode(&lateNode);
    check(lateNode.getChildren().empty(), "RichText tolerates pending required transform");
    {
        cc::UITransform lateUI(&lateNode); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(lateNode.getChildren().size() == 1, "RichText resolves transform added after component load");
    }
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(lateNode.getChildren().empty(), "RichText drops stale non-owning transform and old segments");
    late.setNode(nullptr);
    cc::Node resizeNode("rich-text-resize-callback");
    cc::UITransform resizeUI(&resizeNode);
    cc::RichText resizeRich;
    resizeRich.setNode(&resizeNode);
    resizeRich.setString("initial");
    auto &manager = cc::UIRendererManager::getInstance();
    manager.updateAllDirtyRenderers();
    bool changedDuringResize = false;
    resizeUI.setSizeChangedCallback([&](float, float) {
        if (changedDuringResize) return;
        changedDuringResize = true;
        resizeRich.setString("callback replacement");
    });
    resizeRich.setString("longer line to resize");
    manager.updateAllDirtyRenderers();
    const auto *resized = getChildRenderer<cc::Label>(resizeNode, 0);
    check(changedDuringResize && resized && resized->getString() == "callback replacement",
          "RichText applies text changed by its size notification");
    cc::Node anchorNode("rich-text-child-anchor-callback");
    cc::UITransform anchorUI(&anchorNode);
    anchorUI.setAnchorPoint(0.F, .5F);
    cc::RichText anchorRich;
    anchorRich.setString("");
    anchorRich.setNode(&anchorNode);
    bool changedDuringChildAttach = false;
    const auto childAdded = anchorNode.on<cc::Node::ChildAdded>([&](cc::Node *, cc::Node *) {
        if (changedDuringChildAttach) return;
        changedDuringChildAttach = true;
        anchorUI.setAnchorPoint(1.F, .5F);
    });
    anchorRich.setString("I<b>I</b>");
    anchorNode.off(childAdded);
    check(changedDuringChildAttach && anchorNode.getChildren().size() == 2,
          "RichText emits child attachment before publishing final anchored layout");
    if (!anchorNode.getChildren().empty()) {
        checkNear(anchorNode.getChildren()[0]->getPosition().x, -anchorUI.getContentSize().x,
                  "RichText applies the anchor changed during child attachment");
    }
    std::printf("rich text runtime: PASS\n");
}

// Keep real JSB wrappers rooted across allocation reuse and GC. Native Nodes are
// deliberately retained too: destruction must retire them before their last owner.
void testRichTextRetainedWrappers(se::ScriptEngine *scriptEngine) {
    struct RetainedSegment {
        cc::IntrusivePtr<cc::Node> node;
        se::Value nodeWrapper;
        se::Value layoutWrapper;
    };
    std::vector<RetainedSegment> retained;
    retained.reserve(12800);
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->create(8, 8);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    cc::IntrusivePtr<cc::SpriteAtlas> atlas(new cc::SpriteAtlas()); atlas->addSpriteFrame("icon", frame);
    cc::IntrusivePtr<cc::TTFFont> font(new cc::TTFFont()); font->setFontFamily("Arial");
    const auto textureRefs = texture->getRefCount(), frameRefs = frame->getRefCount();
    const auto atlasRefs = atlas->getRefCount(), fontRefs = font->getRefCount();
    std::string markup;
    for (int i = 0; i < 32; ++i) markup += "<color=#ff0000>x</color><img src=\"icon\" width=8 height=8/>";
    const auto capture = [&](cc::Node &host) {
        check(host.getChildren().size() == 64, "RichText stress creates 32 labels and 32 images");
        for (size_t i = 0; i < host.getChildren().size(); ++i) {
            auto *renderer = i % 2 ? static_cast<cc::UIRenderer *>(getChildRenderer<cc::Sprite>(host, i))
                                   : static_cast<cc::UIRenderer *>(getChildRenderer<cc::Label>(host, i));
            auto *layout = static_cast<cc::UITransform *>(host.getChildren()[i]->getUIComponent(cc::UITransform::TYPE_ID));
            check(renderer != nullptr && layout != nullptr, "RichText stress preserves alternating segment kinds and layout");
            if (!renderer || !layout) continue;
            RetainedSegment segment;
            segment.node = host.getChildren()[i];
            const bool wrapped = nativevalue_to_se(segment.node.get(), segment.nodeWrapper, nullptr)
                              && nativevalue_to_se(layout, segment.layoutWrapper, nullptr);
            check(wrapped && segment.nodeWrapper.isObject() && segment.layoutWrapper.isObject(),
                  "RichText stress creates real Node and borrowed layout wrappers");
            if (!wrapped || !segment.nodeWrapper.isObject() || !segment.layoutWrapper.isObject()) continue;
            segment.nodeWrapper.setObject(segment.nodeWrapper.toObject(), true);
            segment.layoutWrapper.setObject(segment.layoutWrapper.toObject(), true);
            retained.push_back(std::move(segment));
        }
    };
    const auto checkRetired = [&](size_t begin, size_t end) {
        for (size_t i = begin; i < end; ++i) {
            const auto &segment = retained[i];
            check(!cc::isObjectValid(segment.node.get()) && !segment.node->getParent()
                      && !segment.node->isActive() && !segment.node->getUserData(),
                  "RichText retained Node is retired without parent or renderer");
            check(segment.nodeWrapper.toObject()->getPrivateData() == segment.node.get(),
                  "RichText retained Node wrapper still addresses its retired native Node");
            check(!segment.layoutWrapper.toObject()->getPrivateData(),
                  "RichText disposed layout wrapper cannot resurrect after allocation reuse");
        }
    };
    const int failuresBefore = gFailures;
    for (int cycle = 0; cycle < 100; ++cycle) {
        cc::Node first("rich-text-stress-first"), second("rich-text-stress-second");
        cc::UITransform firstUI(&first), secondUI(&second);
        const size_t begin = retained.size();
        {
            cc::RichText rich;
            rich.setFontSize(8); rich.setLineHeight(10);
            rich.setFontAsset(font); rich.setImageAtlas(atlas); rich.setString(markup);
            rich.setNode(&first); rich.setUITransform(&firstUI);
            capture(first);
            rich.setString("");
            check(first.getChildren().empty(), "RichText stress clearing text detaches every segment");
            size_t pooled = 0;
            for (size_t i = begin; i < retained.size(); ++i) {
                if (retained[i].layoutWrapper.toObject()->getPrivateData()) ++pooled;
            }
            check(pooled == 30, "RichText stress bounds recycled layouts to 20 labels and 10 images");
            check(frame->getRefCount() == frameRefs, "RichText stress pooled images release frame references");
            rich.setString(markup);
            rich.setNode(&second); rich.setUITransform(&secondUI);
            check(first.getChildren().empty(), "RichText stress changing host clears the previous host");
            checkRetired(begin, retained.size());
            capture(second);
            rich.setEnabled(false); rich.setString("");
            check(second.getChildren().size() == 64, "RichText stress defers disabled layout changes");
            rich.setEnabled(true);
            check(second.getChildren().empty(), "RichText stress enabling consumes the deferred clear");
            if (cycle % 2 == 0) {
                rich.setString(markup); // Destroy with active children on half the cycles.
            } else {
                rich.setFontAsset(nullptr); rich.setImageAtlas(nullptr);
                check(font->getRefCount() == fontRefs && atlas->getRefCount() == atlasRefs,
                      "RichText stress explicit asset clear releases pooled and measurement ownership");
            }
        }
        check(first.getChildren().empty() && second.getChildren().empty(), "RichText stress destruction clears both hosts");
        checkRetired(begin, retained.size());
        check(font->getRefCount() == fontRefs && atlas->getRefCount() == atlasRefs
                  && frame->getRefCount() == frameRefs && texture->getRefCount() == textureRefs,
              "RichText stress returns all shared resource references to baseline");
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        if ((cycle + 1) % 10 == 0) {
            scriptEngine->garbageCollect();
            checkRetired(0, retained.size());
        }
    }
    check(retained.size() == 12800, "RichText stress retains both wrapper batches across all 100 cycles");
    std::printf("rich text retained wrappers: %s (100 cycles, %zu Nodes, %zu layouts, 10 GC checkpoints)\n",
                failuresBefore == gFailures ? "PASS" : "FAIL", retained.size(), retained.size());
}

void testLayoutAndMaterials() {
    cc::UITransform transform;
    int changes = 0;
    struct Capture {
        int *live;
        explicit Capture(int *count) : live(count) { ++*live; }
        Capture(const Capture &other) : live(other.live) { ++*live; }
        ~Capture() { --*live; }
    };
    int live=0;
    { Capture owner(&live);transform.setSizeChangedCallback([&,owner](float width,float height) { ++changes; }); }
    transform.setContentSize(80, 20); transform.setContentSize(80, 20);
    check(changes == 1 && live>0, "size callback fires only on mutation and owns closure");
    transform.detach();
    check(live==0, "detach releases size callback ownership");
    transform.setContentSize(90, 30); check(changes == 1, "no callback after detach");
    {
        cc::Node firstHost("first-layout-host");
        cc::Node host("short-lived-layout-host");
        transform.setNode(&firstHost);
        Capture owner(&live);
        transform.setSizeChangedCallback([&, owner](float, float) { ++changes; });
        transform.setNode(&host);
        transform.setContentSize(81, 21);
        check(changes == 2, "moving a live layout keeps its size callback");
    }
    check(live == 0, "destroying the layout host releases the size callback");
    transform.setContentSize(91, 31);
    check(changes == 2, "an orphaned layout cannot notify its destroyed host");
    transform.detach();
    cc::IntrusivePtr<cc::Material> builtin(new cc::Material());
    cc::BuiltinResMgr::getInstance()->addAsset("ui-sprite-material", builtin);
    cc::BuiltinResMgr::getInstance()->addAsset("ui-graphics-material", builtin);
    cc::Label label;
    check(label.getRenderMaterial() == builtin, "Label resolves builtin material in native");
    cc::IntrusivePtr<cc::Material> custom(new cc::Material()); label.setMaterial(custom);
    check(label.getRenderMaterial() == custom, "Label custom material overrides default");
    cc::Node labelNode("label-material-slots"); cc::UITransform labelUI(&labelNode);
    label.setNode(&labelNode); label.setUITransform(&labelUI);
    label.setFontSize(16); label.setLineHeight(20); label.setString("material");
    auto *labelEntity = static_cast<cc::RenderEntity *>(labelNode.getUserData());
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == custom, "Label submits custom slot material");
    cc::IntrusivePtr<cc::Material> labelInstance(label.getMaterialInstance(0));
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == labelInstance, "Label submits actual native instance");
    label.setSharedMaterial(nullptr, 0); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 0, "explicit empty Label slot clears old draw info");
    label.setMaterial(nullptr); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 1
          && labelEntity->getStaticRenderDrawInfo(0)->getMaterial() == builtin, "Label custom clear restores builtin submission");
    label.setSharedMaterial(custom, 2);
    const auto retainedRefs = custom->getRefCount();
    check(label.getSharedMaterialCount() == 3, "secondary Label slots have native array extent");
    label.resizeMaterials(1);
    check(label.getSharedMaterialCount() == 1 && custom->getRefCount() < retainedRefs, "shrinking Label slots releases shared references");
    label.resizeMaterials(0); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(labelEntity && labelEntity->getStaticDrawInfoSize() == 0, "empty Label array clears renderer");
    label.setNode(nullptr); label.setUITransform(nullptr);
    cc::Node node("graphics-default-material"); cc::UITransform ui(&node);
    cc::Graphics graphics; graphics.setNode(&node);
    graphics.rect(0, 0, 4, 4); graphics.fill();
    auto *entity = static_cast<cc::RenderEntity *>(node.getUserData());
    if (entity) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(entity->getRenderDrawInfosSize() == 1 && entity->getRenderDrawInfoAt(0)->getMaterial() == builtin, "Graphics native draw uses builtin material");
    } else check(false, "Graphics has render entity");
    std::printf("layout/material ownership: PASS\n");
}

void testGraphicsMeshes() {
    cc::Node node("graphics-gpu");
    cc::Graphics graphics; graphics.setNode(&node);
    graphics.setFillColor(cc::Color(200,40,20,128));
    graphics.rect(-700,-300,1400,600);graphics.fill();
    graphics.flushRenderData();
    check(graphics.getRenderEntity()->getRenderDrawInfosSize() == 1, "Explicit Graphics update builds native draw info before the manager tick");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    node.setActiveInHierarchy(true);
    node._setLocalOpacity(.5F);
    cc::Batcher2d().walk(&node, 1.F, false);
    auto *entity=graphics.getRenderEntity();
    check(entity->getUseLocal() && entity->getRenderTransform()==&node,"Graphics uses Node local UBO rather than baking world positions");
    check(entity->getRenderDrawInfosSize()==1,"Graphics exposes one native mesh chunk");
    if(entity->getRenderDrawInfosSize()) {
        auto *draw=entity->getRenderDrawInfoAt(0);
        check(draw->getTexture()==nullptr && draw->getStride()==8,"Graphics has distance layout and no texture");
        check(draw->getVbCount()==4 && draw->getIbCount()==6,"Graphics rectangle triangulates");
        checkNear(draw->getVDataBuffer()[0],-700,"Graphics is not clipped to 256 canvas");
        checkNear(draw->getVDataBuffer()[6],128.F/255,"Graphics preserves vertex alpha like Web VERTEX fill-color mode");
        checkNear(entity->getOpacity(),.5F,"Graphics preserves cascaded opacity for descendants");
        auto *ia=draw->requestIA(cc::Root::getInstance()->getDevice());draw->uploadBuffers();
        check(ia->getVertexBuffers()[0]->getSize()==128 && ia->getVertexBuffers()[0]->getStride()==32,"Graphics uploads actual 8-float GPU vertices");
        check(ia->getIndexBuffer()->getSize()==12 && ia->getAttributes().back().name=="a_dist","Graphics GPU index data and distance attribute");
        auto *vertices = draw->getVDataBuffer();
        auto *indices = draw->getIDataBuffer();
        for(int i=0;i<1000;++i) cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(entity->getRenderDrawInfoAt(0) == draw && draw->getVDataBuffer() == vertices && draw->getIDataBuffer() == indices,
              "Graphics idle prepare retains mesh/IA storage");
    }
    graphics.clear();
    check(entity->getRenderDrawInfosSize()==0,"Graphics clear drops draws and old GPU chunks");
    for(int i=0;i<20000;++i) graphics.rect(i*2,0,1,1);
    graphics.fill();cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(entity->getRenderDrawInfosSize()==2,"Graphics splits meshes above 65535 vertices");
    uint32_t indices=0;
    for(uint32_t k=0;k<entity->getRenderDrawInfosSize();++k) {
        auto *draw=entity->getRenderDrawInfoAt(k);indices+=draw->getIbCount();
        check(draw->getVbCount()<=65535,"Graphics chunk fits uint16 indices");
        bool valid=true;for(uint32_t i=0;i<draw->getIbCount();++i) if(draw->getIDataBuffer()[i]>=draw->getVbCount()) valid=false;
        check(valid,"Graphics remapped indices stay within chunk");
        auto *ia=draw->requestIA(cc::Root::getInstance()->getDevice());draw->uploadBuffers();
        check(ia->getVertexBuffers()[0]->getSize()==draw->getVbCount()*32,"Graphics large mesh GPU upload has correct size");
    }
    check(indices==120000,"Graphics chunking preserves all triangles");
    graphics.setNode(nullptr);

    cc::Node maskNode("mask-geometry");cc::UITransform ui(&maskNode);ui.setContentSize(500,200);ui.setAnchorPoint(.25F,.75F);
    cc::Mask mask;mask.setNode(&maskNode);cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(mask.getRenderEntity()->getRenderDrawInfosSize()==1,"Mask rectangle uses native graphics mesh");
    if(mask.getRenderEntity()->getRenderDrawInfosSize()) checkNear(mask.getRenderEntity()->getRenderDrawInfoAt(0)->getVDataBuffer()[0],-125,"Mask rectangle follows native anchor");
    mask.setType(1);mask.setSegments(16);cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(mask.getRenderEntity()->getRenderDrawInfoAt(0)->getVbCount()==16,"Mask ellipse follows segments");
    mask.setType(2);
    {
        cc::Graphics source;source.rect(0,0,20,40);source.fill();mask.setGraphics(&source);cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        auto *stencil = mask.getRenderEntity();
        check(stencil->getRenderDrawInfosSize() == 1, "Mask consumes Graphics directly without frame texture");
        if (stencil->getRenderDrawInfosSize()) {
            auto *draw = stencil->getRenderDrawInfoAt(0);
            check(draw->getVbCount() == 4 && draw->getIbCount() == 6, "Rectangle stencil submits four vertices and six indices");
        }
        const auto submittedMaterial = [stencil]() -> cc::Material * {
            return stencil->getRenderDrawInfosSize() ? stencil->getRenderDrawInfoAt(0)->getMaterial() : nullptr;
        };
        cc::IntrusivePtr<cc::Material> custom(new cc::Material());
        source.setMaterial(custom);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(submittedMaterial() == custom.get(), "Mask draw uses the helper's shared material");
        auto *instance = source.getMaterialInstance(0);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(instance && submittedMaterial() == instance, "Mask draw uses the helper's material instance");
        source.setSharedMaterial(nullptr, 0);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(mask.getRenderEntity()->getRenderDrawInfosSize() == 0, "Mask observes explicit null stencil material");
        source.setMaterial(nullptr);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(mask.getRenderEntity()->getRenderDrawInfosSize() == 1, "Mask restores the helper's builtin stencil material");
        mask.setType(0);
        source.setMaterial(custom);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(submittedMaterial() == custom.get(), "Mask uses the forwarded material with generated rectangle geometry");
        source.setMaterial(nullptr);
        mask.setType(2);
        source.clear();cc::UIRendererManager::getInstance().updateAllDirtyRenderers();check(mask.getRenderEntity()->getRenderDrawInfosSize()==0,"Mask observes source clear in native");
        source.circle(0,0,10);source.fill();cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(mask.getRenderEntity()->getRenderDrawInfosSize()==1,"Mask observes new source geometry");
    }
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();check(mask.getRenderEntity()->getRenderDrawInfosSize()==0,"Graphics destruction invalidates non-owning consumers before geometry release");
    mask.setGraphics(nullptr);mask.setNode(nullptr);
    {
        cc::Node owner("replace-mask-transform");
        cc::Mask shape;
        shape.setNode(&owner);
        {
            cc::UITransform original(&owner);
            cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
            check(shape.getRenderEntity()->getRenderDrawInfosSize() == 1, "late transform schedules Mask shape");
        }
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(shape.getRenderEntity()->getRenderDrawInfosSize() == 0, "destroyed transform clears Mask shape");
        cc::UITransform replacement(&owner);
        replacement.setContentSize(18, 27);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(shape.getRenderEntity()->getRenderDrawInfosSize() == 1, "replacement transform rebuilds Mask shape");
        cc::Node nextOwner("new-mask-owner");
        cc::UITransform nextLayout(&nextOwner);
        nextLayout.setContentSize(40, 50);
        shape.setNode(&nextOwner);
        replacement.setContentSize(80, 90);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        auto *entity = shape.getRenderEntity();
        check(entity->getRenderDrawInfosSize() == 1, "moving Mask rebuilds geometry on its new node");
        if (entity->getRenderDrawInfosSize()) {
            checkNear(entity->getRenderDrawInfoAt(0)->getVDataBuffer()[0], -20.F, "Mask uses its new layout after the former layout changes");
        }
    }
    {
        auto orphan=std::make_unique<cc::Node>("orphan-mask");
        mask.setNode(orphan.get());orphan.reset();
        mask.setType(1);cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(mask.getNode()==nullptr && mask.getRenderEntity()->getNode()==nullptr,"Node destruction clears Mask borrowed Node before later setters");
    }
    {
        auto atlas = cc::LetterAtlas::acquire();
        const auto initialRefs = atlas->getRefCount();
        cc::Label label;
        label.setCacheMode(2);
        {
            cc::Node host("short-lived-char-host");
            label.setNode(&host);
            label.getLetterTexture();
            check(atlas->getRefCount() == initialRefs + 1, "attached CHAR Label owns one atlas reference");
        }
        check(atlas->getRefCount() == initialRefs, "host destruction releases the orphaned Label's CHAR atlas reference");
        cc::Node next("next-char-host");
        label.setNode(&next);
        label.getLetterTexture();
        check(atlas->getRefCount() == initialRefs + 1, "reattached CHAR Label reacquires one atlas reference");
        label.setNode(nullptr);
        check(atlas->getRefCount() == initialRefs, "explicit detach releases the same atlas reference");
        label.getLetterTexture();
        label.setNode(nullptr);
        check(atlas->getRefCount() == initialRefs, "explicit detach releases an atlas acquired without a host");
    }
    {
        cc::Node firstNode("letter-cache-first"),secondNode("letter-cache-second");
        cc::UITransform firstUI(&firstNode),secondUI(&secondNode);
        auto first=std::make_unique<cc::Label>();cc::Label second;
        first->setNode(&firstNode);first->setUITransform(&firstUI);second.setNode(&secondNode);second.setUITransform(&secondUI);
        for(auto *label:{first.get(),&second}) { label->setCacheMode(2);label->setFont("14px Arial");label->setFontSize(14);label->setLineHeight(18);label->setString("AB");cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); }
        check(countLabelCoverage(*first)>0 && countLabelCoverage(second)>0,"Two CHAR Labels acquire registry-owned atlas leases");
        first.reset();second.setString("BA");cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(countLabelCoverage(second)>0,"Releasing one CHAR Label preserves the other lease");
        for(int i=0;i<1000;++i) { second.setCacheMode(0);second.setCacheMode(2);cc::UIRendererManager::getInstance().updateAllDirtyRenderers(); }
        check(countLabelCoverage(second)>0,"CHAR cache releases and reacquires the last lease across 1000 switches");
        second.setLineHeight(19.12890625F);
        second.setEnableOutline(true);
        second.setOutlineWidth(1.5F);
        second.setString("A\nB");
        second.setOverflow(3);
        secondUI.setWidth(240.F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(secondUI.getHeight(), 41.26F, "CHAR rounds total line height before adding outline margins");
        checkNear(second.measureUnwrappedText("A\nB").height, secondUI.getHeight(), "CHAR measurement matches rendered layout");
        second.setEnableOutline(false);
        second.setOverflow(0);
        second.setString("AAA");
        second.updateRenderData();
        const float naturalWidth = secondUI.getWidth();
        for (const float spacing : {4.5F, -3.F, 0.F}) {
            second.setSpacingX(spacing);
            second.updateRenderData();
            checkNear(secondUI.getWidth(), naturalWidth + 2.F * spacing, "CHAR inserts spacing between glyphs only");
            checkNear(second.measureUnwrappedText("AAA\r\nA").width, secondUI.getWidth(), "CHAR measurement and layout apply identical spacing");
        }
        second.setString("A");
        second.updateRenderData();
        const auto single = submittedTexturePixels(second.getRenderEntity());
        second.setSpacingX(-secondUI.getWidth());
        second.setString("AA");
        second.updateRenderData();
        const auto overlap = submittedTexturePixels(second.getRenderEntity());
        bool layersMatch = !single.empty() && overlap.size() == single.size();
        for (size_t i = 3; layersMatch && i < single.size(); i += 4) {
            const unsigned alpha = single[i];
            layersMatch = overlap[i] == alpha + ((255U - alpha) * alpha + 127U) / 255U;
        }
        check(layersMatch, "Negative CHAR spacing composites the two glyph masks at the same position");
        second.setFontSize(32);
        second.setLineHeight(32);
        second.setSpacingX(0);
        second.setOverflow(3);
        secondUI.setWidth(86);
        second.setString("AA AA AA");
        second.updateRenderData();
        const auto softBreaks = submittedTexturePixels(second.getRenderEntity());
        checkNear(secondUI.getHeight(), 96.F, "CHAR moves a whole word onto the following line");
        second.setString("AA \nAA \nAA");
        second.updateRenderData();
        check(!softBreaks.empty() && softBreaks == submittedTexturePixels(second.getRenderEntity()),
              "CHAR soft word breaks place each glyph at the explicit line-break position");
    }
    {
        auto orphan=std::make_unique<cc::Node>("orphan-graphics");
        graphics.setNode(orphan.get());orphan.reset();
        check(graphics.getNode()==nullptr && graphics.getRenderEntity()->getNode()==nullptr,"Node destruction detaches Graphics entity before owner release");
    }
    std::printf("graphics native meshes: PASS\n");
}

void testSpriteApiAndMaterials() {
    auto *resources = cc::BuiltinResMgr::getInstance();
    cc::IntrusivePtr<cc::Material> normal(new cc::Material()), gray(new cc::Material()), alpha(new cc::Material()), grayAlpha(new cc::Material());
    resources->addAsset("ui-sprite-material", normal);
    normal = resources->get<cc::Material>("ui-sprite-material");
    resources->addAsset("ui-sprite-gray-material", gray);
    resources->addAsset("ui-sprite-alpha-sep-material", alpha);
    resources->addAsset("ui-sprite-gray-alpha-sep-material", grayAlpha);
    cc::IntrusivePtr<cc::Texture2D> texture(new cc::Texture2D()); texture->create(4,4);
    cc::IntrusivePtr<cc::SpriteFrame> frame(new cc::SpriteFrame()); frame->resetWithTexture(texture);
    const auto textureRefs = texture->getRefCount(), frameRefs = frame->getRefCount();
    cc::Sprite sprite; sprite.setFrame(frame);
    check(texture->getRefCount() == textureRefs + 1 && frame->getRefCount() == frameRefs + 1, "Sprite retains frame and texture");
    checkNear(sprite.getFillRange(), 0, "Sprite default fillRange matches Web");
    sprite.setFillStart(2); sprite.setFillRange(-2);
    checkNear(sprite.getFillStart(), 1, "native fillStart clamp"); checkNear(sprite.getFillRange(), -1, "native fillRange clamp");
    check(sprite.getRenderMaterial() == normal && sprite.getSharedMaterial(0) == normal, "native normal/shared builtin selection");
    sprite.setGrayscale(true); check(sprite.getRenderMaterial() == gray, "native grayscale variant");
    // These exercise format-driven selection, not compressed texture decoding.
    texture->_format = cc::PixelFormat::RGBA_ETC1;
    check(sprite.getRenderMaterial() == grayAlpha, "native grayscale/alpha-separated variant");
    sprite.setGrayscale(false); check(sprite.getRenderMaterial() == alpha, "native alpha-separated variant");
    texture->_format = cc::PixelFormat::RGB_A_PVRTC_4BPPV1;
    check(sprite.getRenderMaterial() == alpha, "native PVRTC4 alpha variant");
    texture->_format = cc::PixelFormat::RGB_A_PVRTC_2BPPV1;
    check(sprite.getRenderMaterial() == alpha, "native PVRTC2 alpha variant");
    texture->_format = cc::PixelFormat::RGBA8888;
    sprite.setGrayscale(true);
    cc::IntrusivePtr<cc::Material> instance(sprite.getMaterialInstance(0));
    check(instance != gray && instance->getParent() == gray, "material instance keeps native parent");
    sprite.refreshMaterial(); frame->setRectWidth(3); sprite.setFrame(frame);
    check(sprite.getMaterialInstance(0) == instance, "geometry and unchanged variant preserve instance");
    sprite.setGrayscale(false); check(sprite.getRenderMaterial() == normal, "variant change invalidates old instance");
    sprite.setGrayscale(true);
    cc::IntrusivePtr<cc::Material> custom(new cc::Material()); const auto materialRefs = custom->getRefCount();
    sprite.setMaterial(custom); sprite.setGrayscale(true); sprite.refreshMaterial();
    check(sprite.getRenderMaterial() == custom && custom->getRefCount() > materialRefs, "custom material wins and is retained");
    sprite.setMaterial(nullptr); check(sprite.getRenderMaterial() == gray && custom->getRefCount() == materialRefs, "clear custom returns to builtin and releases reference");
    sprite.setSharedMaterial(custom,0); check(sprite.getRenderMaterial() == custom, "shared material replacement affects renderer");
    sprite.setSharedMaterial(nullptr,0); check(sprite.getRenderMaterial() == nullptr, "shared material clear removes render slot");
    sprite.setSharedMaterial(custom,1); auto *secondInstance = sprite.getMaterialInstance(1);
    check(secondInstance != custom && secondInstance->getParent() == custom && sprite.getRenderMaterial(1) == secondInstance, "secondary material instance is independent");
    sprite.setMaterialInstance(nullptr,1); check(sprite.getRenderMaterial(1) == nullptr, "secondary instance clear releases slot");
    sprite.setSharedMaterial(custom,0); auto *promoted = sprite.getMaterialInstance(0);
    sprite.setSharedMaterial(promoted,0);
    check(sprite.getSharedMaterial(0) == promoted && promoted->getParent() == custom, "instance promotion retains before cache release");
    sprite.setSharedMaterial(nullptr,0);
    check(custom->getRefCount() == materialRefs, "all material slots release custom reference");
    sprite.setMaterial(nullptr);
    cc::IntrusivePtr<cc::RenderTexture> rt(new cc::RenderTexture());
    sprite.setSizeMode(0);
    sprite.setFrame(makeSquareFrame(rt, 4.F));
    check(frame->getRefCount() == frameRefs, "scalar frame replacement drops old asset");
    auto *rtMaterial = sprite.getRenderMaterial();
    check(rtMaterial && rtMaterial != gray && !rtMaterial->_defines.empty()
          && cc::macroRecordAsBool(rtMaterial->_defines[0].at("SAMPLE_FROM_RT")), "native RenderTexture variant includes macro");
    sprite.setEnabled(false); sprite.setFrame(frame);
    check(!sprite.getRenderEntity()->isEnabled(), "frame assignment preserves disabled Sprite state");
    sprite.clearFrame();
    check(frame->getRefCount() == frameRefs && texture->getRefCount() == textureRefs, "clearFrame releases frame and texture");
    cc::Node node("sprite-shape-updates"); cc::UITransform ui(&node); ui.setContentSize(100,100);
    cc::Sprite dynamic; dynamic.setNode(&node); dynamic.setUITransform(&ui); dynamic.setSizeMode(0); dynamic.setFrame(frame);
    dynamic.setType(3); dynamic.setFillStart(0); dynamic.setFillRange(0.5F); dynamic.prepare(1.F);
    auto *entity = dynamic.getRenderEntity();
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -50, "initial bar origin");
    ui.setContentSize(200,100); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -100, "native size change refreshes vertices");
    node.setPosition(20,0,0); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], -80, "native Node movement refreshes vertices");
    ui.setAnchorPoint(0,0); dynamic.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[0], 20, "native anchor change refreshes vertices");
    dynamic.setFillRange(0); dynamic.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 0, "zero fill clears previous draw data");
    dynamic.setFillRange(0.5F); dynamic.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 1, "nonzero fill restores draw data");
    dynamic.setEnabled(false); dynamic.prepare(1.F); check(!entity->isEnabled(), "manual prepare preserves disabled entity");
    cc::Node radialNode("radial-state"); cc::UITransform radialUI(&radialNode); radialUI.setContentSize(100,100);
    cc::Sprite radial; radial.setNode(&radialNode); radial.setUITransform(&radialUI); radial.setSizeMode(0);
    radial.setType(3); radial.setFillType(2); radial.setFillRange(0.5F); radial.setFillCenter(0.5F,0.5F);
    frame->setRect(0.5F,0.25F,2,1); radial.setFrame(frame);
    for(int flags=0;flags<8;flags++) {
        frame->setRotated((flags&1)!=0); frame->setFlipUVX((flags&2)!=0); frame->setFlipUVY((flags&4)!=0);
        radial.prepare(1.F);
        cc::FilledSpriteGeometryParams p; p.contentSize=cc::Vec2(100,100); p.frameRect=cc::Rect(0.5F,0.25F,2,1);
        p.textureSize=cc::Vec2(4,4); p.fillCenter=cc::Vec2(0.5F,0.5F); p.fillRange=0.5F; p.rotated=(flags&1)!=0;
        const auto expected=cc::buildRadialSpriteMesh(p); const auto *draw=radial.getRenderEntity()->getStaticRenderDrawInfo(0);
        check(draw->getVbCount()==expected.vertices.size(), "radial component uses Web triangle layout");
        for(size_t v=0;v<expected.vertices.size();v++) {
            checkNear(draw->getVDataBuffer()[v*9+3], expected.vertices[v].uv.x, "radial follows Web rotation/flip U convention");
            checkNear(draw->getVDataBuffer()[v*9+4], expected.vertices[v].uv.y, "radial follows Web rotation/flip V convention");
        }
    }
    std::printf("sprite API/materials: PASS\n");
}

void testMaskHitLifecycle() {
    cc::IntrusivePtr<cc::Node> outer(new cc::Node("hit-outer")), inner(new cc::Node("hit-inner")), child(new cc::Node("hit-child"));
    outer->addChild(inner); inner->addChild(child);
    cc::UITransform outerUI(outer), innerUI(inner), childUI(child);
    outerUI.setContentSize(100, 80); innerUI.setContentSize(200, 200); childUI.setContentSize(400, 400);
    cc::Mask mask; mask.setNode(outer); mask.setRadius(20);
    check(mask.isHitWorldPointXY(0,0), "rounded mask accepts center");
    check(!mask.isHitWorldPointXY(49,39), "rounded mask rejects cut corner");
    check(mask.isHitWorldPointXY(50,0), "rounded rect includes straight boundary");
    check(childUI.containsWorldPoint(cc::Vec2(49,39)) && !childUI.hitTestWorldXY(49,39), "UITransform applies ancestor rounded mask");
    mask.setEnabled(false);
    check(childUI.hitTestWorldXY(49,39), "disabled mask does not clip input");
    mask.setEnabled(true); mask.setInverted(true);
    check(!childUI.hitTestWorldXY(0,0) && childUI.hitTestWorldXY(49,39), "inverted mask complements input shape");
    mask.setInverted(false); mask.setType(1);
    check(!mask.isHitWorldPointXY(50,0), "ellipse excludes its exact boundary like Web");
    check(mask.isHitWorldPointXY(0,0), "ellipse accepts center");
    mask.setType(2);
    check(mask.isHitWorldPointXY(49,39), "custom stencil input uses UI bounds like Web");
    mask.setType(3);
    check(mask.isHitWorldPointXY(49,39), "sprite stencil input uses UI bounds like Web");
    mask.setType(0); mask.setRadius(1000); cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(mask.getRenderEntity()->getRenderDrawInfoAt(0)->getVbCount()>4, "radius generates actual curved mask geometry");
    check(!mask.isHitWorldPointXY(49,39), "radius clamps to half the shortest dimension");
    outerUI.setContentSize(200,160); outerUI.setAnchorPoint(0,0);
    check(mask.isHitWorldPointXY(100,80) && !mask.isHitWorldPointXY(0,0), "hit uses current size and anchor before render prepare");
    outerUI.setContentSize(100,80); outerUI.setAnchorPoint(.5F,.5F); mask.setRadius(20);
    outer->setPosition(10,20,0); outer->setScale(2,.5F,1); outer->setRotationFromEuler(0,0,90);
    const auto worldCenter=outerUI.convertToWorldSpaceAR(cc::Vec2(0,0));
    const auto worldCorner=outerUI.convertToWorldSpaceAR(cc::Vec2(49,39));
    check(mask.isHitWorldPointXY(worldCenter.x,worldCenter.y) && !mask.isHitWorldPointXY(worldCorner.x,worldCorner.y), "mask inverse handles translation nonuniform scale rotation");
    cc::Mask nested; nested.setNode(inner); nested.setType(1);
    innerUI.setContentSize(20,20);
    const auto outsideInner=outerUI.convertToWorldSpaceAR(cc::Vec2(15,0));
    check(!childUI.hitTestWorldXY(outsideInner.x,outsideInner.y), "nested mask clips input through live ancestor slots");
    nested.setEnabled(false);
    check(childUI.hitTestWorldXY(outsideInner.x,outsideInner.y), "disabled nested mask preserves enclosing mask");
    child->setParent(nullptr);
    check(childUI.hitTestWorldXY(worldCorner.x,worldCorner.y), "reparenting immediately drops old masks without stale cache");
    outer->setScale(0,1,1);
    check(!outerUI.containsWorldPoint(worldCenter) && !mask.isHitWorldPointXY(worldCenter.x,worldCenter.y), "singular transforms cannot produce phantom hits");
    mask.setNode(nullptr);
    check(!mask.isHitWorldPointXY(0,0), "detached mask hit test is safe");
    nested.setNode(nullptr);
    {
        auto owner=std::make_unique<cc::Node>("destroy-before-hit");
        cc::UITransform transform(owner.get()); mask.setNode(owner.get()); owner.reset();
        check(!mask.isHitWorldPointXY(0,0) && !transform.hitTestWorldXY(0,0), "Node destruction invalidates all hit-test borrows");
    }
    std::printf("mask hit lifecycle: PASS\n");
}

void testRootRegistrationLifecycle() {
    cc::Batcher2d batcher(cc::Root::getInstance());
    {
        cc::Node node("root-and-richtext");cc::UITransform transform(&node);
        cc::RenderRoot2D root;cc::RichText text;root.setNode(&node);text.setNode(&node);
        check(node.getUIComponent(cc::RenderRoot2D::TYPE_ID)==&root && node.getUIComponent(cc::RichText::TYPE_ID)==&text,"RenderRoot2D and RichText occupy distinct live Node slots");
        check(cc::RichText::TYPE_ID==8 && cc::RenderRoot2D::TYPE_ID==9,"existing UI type IDs remain stable while Root gets a new slot");
        root.setNode(nullptr);text.setNode(nullptr);
    }
    cc::IntrusivePtr<cc::Node> parent(new cc::Node("root-parent")), first(new cc::Node("root-first")), second(new cc::Node("root-second"));
    parent->addChild(first); parent->addChild(second);
    const auto refs=first->getRefCount();
    constexpr uint32_t registrationType = 0;
    batcher.addRootNode(second);batcher.addRootNode(first);batcher.addRootNode(first);batcher.addRootNode(nullptr);
    check(first->getUIComponent(registrationType) && second->getUIComponent(registrationType),
          "root registration attaches each live node");
    check(first->getRefCount()==refs,"root registration links do not retain Nodes");
    batcher.removeRootNode(second);batcher.removeRootNode(second);
    check(first->getUIComponent(registrationType) && !second->getUIComponent(registrationType),
          "repeated root removal leaves other registrations intact");
    batcher.syncRootNodesToNative({second,nullptr,first,second});
    first->_setFinalOpacity(.25F);
    second->_setFinalOpacity(.5F);
    batcher.fillBuffersAndMergeBatches();
    check(first->getUIComponent(registrationType) && second->getUIComponent(registrationType)
              && first->_getFinalOpacity() == .25F && second->_getFinalOpacity() == .5F,
          "legacy root synchronization registers nodes but skips traversal without a Scene");
    batcher.syncRootNodesToNative({});
    check(!first->getUIComponent(registrationType) && !second->getUIComponent(registrationType),
          "clearing synchronized roots releases the node registrations");
    cc::RenderRoot2D component;
    {
        auto node=std::make_unique<cc::Node>("root-destroy-first");
        component.setNode(node.get());component.setEnabled(true);
        batcher.addRootNode(node.get());
        check(node->getUIComponent(cc::RenderRoot2D::TYPE_ID)==&component,"RenderRoot2D participates in Node destruction notifications");
        node.reset();
        batcher.fillBuffersAndMergeBatches();
        check(component.getNode()==nullptr,"Node destruction detaches its root component before traversal");
    }
    component.setEnabled(false);component.setNode(first);
    cc::Component *base=&component;base->setNode(second);
    check(first->getUIComponent(cc::RenderRoot2D::TYPE_ID)==nullptr && second->getUIComponent(cc::RenderRoot2D::TYPE_ID)==&component,"generic Component node changes dispatch to renderer-specific lifecycle");
    component.setNode(nullptr);
    for(int i=0;i<1000;++i) {
        auto node=std::make_unique<cc::Node>("root-repeat");batcher.addRootNode(node.get());node.reset();
        batcher.sortRootNodes();
    }
    {
        cc::Batcher2d temporary(cc::Root::getInstance());temporary.addRootNode(first);
        check(first->getUIComponent(0)!=nullptr,"batcher owns a non-owning Node registration link");
    }
    check(first->getUIComponent(0)==nullptr,"batcher destruction detaches registration links from surviving Nodes");

    cc::IntrusivePtr<cc::Scene> scene(new cc::Scene("root-callback-scene"));
    cc::IntrusivePtr<cc::Node> a(new cc::Node("root-callback-a")), b(new cc::Node("root-callback-b")), c(new cc::Node("root-callback-c"));
    scene->addChild(a);scene->addChild(b);scene->addChild(c);scene->load();
    for(auto *node:{a.get(),b.get(),c.get()}) node->setActiveInHierarchy(true);
    batcher.addRootNode(a); batcher.addRootNode(b);
    a->_setLocalOpacity(.25F); b->_setLocalOpacity(.5F); c->_setLocalOpacity(.75F);
    batcher.fillBuffersAndMergeBatches();
    checkNear(a->_getFinalOpacity(), .25F, "registered root is traversed");
    checkNear(b->_getFinalOpacity(), .5F, "second root is traversed");
    batcher.removeRootNode(b); batcher.addRootNode(c);
    b->_setLocalOpacity(.1F);
    batcher.fillBuffersAndMergeBatches();
    checkNear(b->_getFinalOpacity(), .5F, "removed root is skipped");
    checkNear(c->_getFinalOpacity(), .75F, "new root is traversed");
    cc::IntrusivePtr<cc::Scene> nextScene(new cc::Scene("root-next-scene"));nextScene->load();
    c->setParent(nextScene);c->setActiveInHierarchy(true);
    check(c->getScene()==nextScene.get(),"root reparenting updates the current Scene");
    c->_setFinalOpacity(0.F);
    batcher.fillBuffersAndMergeBatches();
    checkNear(c->_getFinalOpacity(), .75F, "root follows a Scene change on the next traversal");
    c->setParent(nullptr);
    check(c->getScene()==nullptr,"detached root drops its previous Scene pointer");
    {
        auto owner=std::make_unique<cc::Scene>("destroy-scene-before-root");
        owner->addChild(c);owner->load();owner.reset();
        check(c->getParent()==nullptr && c->getScene()==nullptr,"surviving root drops a destroyed Scene owner");
    }
    batcher.syncRootNodesToNative({});
    // A nested root receives both walks. Its final opacity identifies which root ran last.
    a->addChild(c);
    b->setParent(a);
    b->setActiveInHierarchy(true);
    b->_setLocalOpacity(.5F);
    batcher.addRootNode(b);
    batcher.addRootNode(a);
    batcher.fillBuffersAndMergeBatches();
    checkNear(b->_getFinalOpacity(), .5F, "higher sibling index renders after its registered parent");
    b->setSiblingIndex(0);
    batcher.fillBuffersAndMergeBatches();
    checkNear(b->_getFinalOpacity(), .125F, "equal sibling indices render in registration order after reordering");
    batcher.addRootNode(b);
    batcher.fillBuffersAndMergeBatches();
    checkNear(b->_getFinalOpacity(), .125F, "duplicate registrations do not append a second traversal");
    std::printf("root registration lifecycle: PASS\n");
}

void testUITransform() {
    cc::Node node("native-2d-poc");
    node.setPosition(10.F, 20.F, 0.F);
    node.updateWorldTransform();

    cc::UITransform transform(&node);
    transform.setContentSize(100.F, 50.F);
    transform.setAnchorPoint(0.5F, 0.5F);

    const cc::Rect box = transform.getBoundingBox();
    checkNear(box.x, -40.F, "bounding box x");
    checkNear(box.y, -5.F, "bounding box y");
    checkNear(box.width, 100.F, "bounding box width");
    checkNear(box.height, 50.F, "bounding box height");

    const cc::Vec2 world = transform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 10.F, "world space x");
    checkNear(world.y, 20.F, "world space y");

    const cc::Vec2 local = transform.convertToNodeSpaceAR(cc::Vec2(10.F, 20.F));
    checkNear(local.x, 0.F, "node space x");
    checkNear(local.y, 0.F, "node space y");

    check(transform.containsWorldPoint(cc::Vec2(10.F, 20.F)), "contains center");
    check(!transform.containsWorldPoint(cc::Vec2(100.F, 20.F)), "rejects outside");
}

void testSpriteGeometry() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.trim = true;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    check(quad.valid, "simple quad is valid");
    checkNear(quad.vertices[0].position.x, -50.F, "quad left-bottom x");
    checkNear(quad.vertices[0].position.y, -50.F, "quad left-bottom y");
    checkNear(quad.vertices[3].position.x, 50.F, "quad right-top x");
    checkNear(quad.vertices[3].position.y, 50.F, "quad right-top y");
    check(quad.indices[0] == 0 && quad.indices[1] == 1 && quad.indices[2] == 2,
          "quad index order");
}

void testUITransformParity() {
    cc::Node node("parity");
    node.updateWorldTransform();
    cc::UITransform transform(&node);
    transform.setContentSize(180.F, 180.F);

    cc::Rect box = transform.getBoundingBox();
    checkNear(box.x, -90.F, "parity bbox x");
    checkNear(box.y, -90.F, "parity bbox y");
    checkNear(box.width, 180.F, "parity bbox width");
    checkNear(box.height, 180.F, "parity bbox height");

    transform.setAnchorPoint(0.1F, 0.6F);
    box = transform.getBoundingBox();
    checkNear(box.x, -18.F, "parity anchor bbox x");
    checkNear(box.y, -108.F, "parity anchor bbox y");

    node.setPosition(100.5F, -10.5F, 0.F);
    node.updateWorldTransform();
    box = transform.getBoundingBox();
    checkNear(box.x, 82.5F, "parity position bbox x");
    checkNear(box.y, -118.5F, "parity position bbox y");

    node.setRotationFromEuler(0.F, 0.F, 45.F);
    node.updateWorldTransform();
    box = transform.getBoundingBox();
    checkClose(box.x, 36.86F, 0.05F, "parity rotated bbox x");
    checkClose(box.y, -99.6F, 0.05F, "parity rotated bbox y");
    checkClose(box.width, 254.56F, 0.05F, "parity rotated bbox width");
    checkClose(box.height, 254.56F, 0.05F, "parity rotated bbox height");

    cc::Node convertNode("convert");
    convertNode.setPosition(50.F, 50.F, 0.F);
    convertNode.updateWorldTransform();
    cc::UITransform convertTransform(&convertNode);
    convertTransform.setContentSize(180.F, 180.F);
    const cc::Vec2 local = convertTransform.convertToNodeSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(local.x, -50.F, "parity convert local x");
    checkNear(local.y, -50.F, "parity convert local y");
    const cc::Vec2 world = convertTransform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 50.F, "parity convert world x");
    checkNear(world.y, 50.F, "parity convert world y");
    cc::Node *child = ccnew cc::Node("convert-depth");
    child->setParent(&convertNode);
    child->setPosition(1.F, 2.F, 3.F);
    child->setScale(2.F, 3.F, 4.F);
    child->setRotationFromEuler(90.F, 0.F, 0.F);
    cc::UITransform childTransform(child);
    const auto projected = childTransform.convertToWorldSpaceARXYZ(2.F, 3.F, 5.F);
    checkNear(projected.x, 55.F, "hierarchical world x");
    checkNear(projected.y, 32.F, "hierarchical world y includes depth");
    checkNear(projected.z, 12.F, "hierarchical world z includes rotation");
    const auto original = childTransform.convertToNodeSpaceARXYZ(projected.x, projected.y, projected.z);
    checkNear(original.x, 2.F, "hierarchical inverse x");
    checkNear(original.y, 3.F, "hierarchical inverse y");
    checkNear(original.z, 5.F, "hierarchical inverse z");
}

void testUITransformScaleParity() {
    cc::Node scaled("scaled");
    scaled.setScale(2.F, 2.F, 1.F);
    scaled.updateWorldTransform();
    cc::UITransform scaledTransform(&scaled);
    scaledTransform.setContentSize(100.F, 100.F);
    const cc::Rect box = scaledTransform.getBoundingBox();
    checkNear(box.x, -100.F, "scaled bbox x");
    checkNear(box.y, -100.F, "scaled bbox y");
    checkNear(box.width, 200.F, "scaled bbox width");
    checkNear(box.height, 200.F, "scaled bbox height");

    cc::Node parent("scaled-parent");
    parent.setPosition(10.F, 10.F, 0.F);
    parent.setScale(2.F, 2.F, 1.F);
    parent.updateWorldTransform();
    auto *child = new cc::Node("scaled-child");
    child->setParent(&parent);
    child->setPosition(10.F, 0.F, 0.F);
    child->updateWorldTransform();
    cc::UITransform childTransform(child);
    childTransform.setContentSize(20.F, 20.F);
    const cc::Vec2 world = childTransform.convertToWorldSpaceAR(cc::Vec2(0.F, 0.F));
    checkNear(world.x, 30.F, "scaled nested world x");
    checkNear(world.y, 10.F, "scaled nested world y");
    const cc::Rect childBox = childTransform.getBoundingBoxToWorld();
    checkNear(childBox.x, 10.F, "scaled nested bbox x");
    checkNear(childBox.y, -10.F, "scaled nested bbox y");
    checkNear(childBox.width, 40.F, "scaled nested bbox width");
    checkNear(childBox.height, 40.F, "scaled nested bbox height");

    cc::Node rotatedScaled("rotated-scaled");
    rotatedScaled.setScale(2.F, 2.F, 1.F);
    rotatedScaled.setRotationFromEuler(0.F, 0.F, 45.F);
    rotatedScaled.updateWorldTransform();
    cc::UITransform rotatedScaledTransform(&rotatedScaled);
    rotatedScaledTransform.setContentSize(100.F, 100.F);
    const cc::Rect rotatedBox = rotatedScaledTransform.getBoundingBox();
    checkClose(rotatedBox.width, 282.84F, 0.1F, "scaled rotated bbox width");
    checkClose(rotatedBox.height, 282.84F, 0.1F, "scaled rotated bbox height");
}

void testUITransformChildBounds() {
    cc::Node parent("parent");
    cc::UITransform parentTransform(&parent);
    parentTransform.setContentSize(100.F, 100.F);
    parentTransform.setAnchorPoint(0.5F, 0.5F);
    parent.updateWorldTransform();

    auto *child = new cc::Node("child");
    child->setParent(&parent);
    child->setPosition(100.F, 0.F, 0.F);
    child->updateWorldTransform();
    cc::UITransform childTransform(child);
    childTransform.setContentSize(50.F, 50.F);
    childTransform.setAnchorPoint(0.5F, 0.5F);
    child->updateWorldTransform();

    const cc::Rect box = parentTransform.getBoundingBoxToWorld();
    checkNear(box.x, -50.F, "child bbox left");
    checkNear(box.y, -50.F, "child bbox bottom");
    checkNear(box.width, 175.F, "child bbox width");
    checkNear(box.height, 100.F, "child bbox height");

    cc::Mat4 target;
    cc::Mat4::createTranslation(-100.F, 0.F, 0.F, &target);
    const cc::Rect localBox = parentTransform.getBoundingBoxTo(target);
    checkNear(localBox.x, 50.F, "target-space bbox left");
    checkNear(localBox.y, -50.F, "target-space bbox bottom");
    checkNear(localBox.width, 175.F, "target-space bbox width");
    checkNear(localBox.height, 100.F, "target-space bbox height");
}

void testUITransformRotatedParity() {
    cc::Node parent("parent");
    parent.setPosition(50.F, 50.F, 0.F);

    auto *node = new cc::Node("node");
    node->setParent(&parent);
    cc::UITransform transform(node);
    transform.setContentSize(180.F, 180.F);
    transform.setAnchorPoint(0.1F, 0.6F);

    auto *child = new cc::Node("child");
    child->setParent(node);
    child->setPosition(50.F, 58.F, 0.F);
    cc::UITransform childTransform(child);
    childTransform.setContentSize(300.F, 150.F);

    parent.updateWorldTransform();
    node->updateWorldTransform();
    child->updateWorldTransform();

    cc::Rect box = transform.getBoundingBoxToWorld();
    checkNear(box.x, -50.F, "world child bbox x");
    checkNear(box.y, -58.F, "world child bbox y");
    checkNear(box.width, 300.F, "world child bbox width");
    checkNear(box.height, 241.F, "world child bbox height");

    parent.setRotationFromEuler(0.F, 0.F, 45.F);
    parent.updateWorldTransform();
    node->updateWorldTransform();
    child->updateWorldTransform();
    box = transform.getBoundingBoxToWorld();
    checkClose(box.x, -114.76F, 0.05F, "rotated world bbox x");
    checkClose(box.y, -39.1F, 0.05F, "rotated world bbox y");
    checkClose(box.width, 355.67F, 0.05F, "rotated world bbox width");
    checkClose(box.height, 324.56F, 0.05F, "rotated world bbox height");

    cc::Node targetNode("target");
    targetNode.setPosition(100.5F, -10.5F, 0.F);
    targetNode.setRotationFromEuler(0.F, 0.F, 60.F);
    targetNode.updateWorldTransform();

    cc::Node source("source");
    cc::UITransform sourceTransform(&source);
    sourceTransform.setContentSize(100.F, 100.F);
    const cc::Rect targetBox = sourceTransform.getBoundingBoxTo(targetNode.getWorldMatrix());
    checkClose(targetBox.x, -109.46F, 0.05F, "rotated target bbox x");
    checkClose(targetBox.y, 23.98F, 0.05F, "rotated target bbox y");
    checkClose(targetBox.width, 136.6F, 0.05F, "rotated target bbox width");
    checkClose(targetBox.height, 136.6F, 0.05F, "rotated target bbox height");
}

void testComponentAttach() {
    cc::Node node("component-attach");
    {
        cc::UITransform transform(&node);
        check(node.getUIComponent() == &transform, "component attached to node");
        check(transform.getNode() == &node, "component node link");
        check(transform.getTypeId() == cc::UITransform::TYPE_ID, "component type id");
    }
    check(node.getUIComponent() == nullptr, "component detached on destroy");

    auto *detached = new cc::UITransform();
    {
        cc::Node other("component-node-destroyed");
        detached->setNode(&other);
        check(other.getUIComponent() == detached, "component attached for node destroy");
    }
    check(detached->getNode() == nullptr, "component cleared on node destroy");
    delete detached;

    cc::UIOpacity moved;
    cc::Node destination("surviving-host");
    struct TransferOnDetach final : cc::Component {
        TransferOnDetach(cc::UIOpacity &peer, cc::Node &destination)
        : peer(peer), destination(destination) {}
        void onDetach() override { peer.setNode(&destination); }
        cc::UIOpacity &peer;
        cc::Node &destination;
    } transfer(moved, destination);
    {
        cc::Node oldHost("retired-host");
        transfer.setNode(&oldHost);
        moved.setNode(&oldHost);
    }
    check(moved.getNode() == &destination && destination.getUIComponent(cc::UIOpacity::TYPE_ID) == &moved,
          "a component moved during host teardown stays attached to its new host");
    moved.setOpacity(102);
    checkNear(destination._getLocalOpacity(), 0.4F, "moved component still updates its new host");
}

void testUIOpacity() {
    cc::Node node("ui-opacity");
    cc::UITransform transform(&node);
    cc::UIOpacity opacity(&node);

    check(node.getUIComponent(cc::UITransform::TYPE_ID) == &transform, "UITransform in multi slot");
    check(node.getUIComponent(cc::UIOpacity::TYPE_ID) == &opacity, "UIOpacity in multi slot");
    check(node.getUIComponent() != nullptr, "first UI component");

    opacity.setOpacity(128.F);
    checkNear(node._getLocalOpacity(), 128.F / 255.F, "UIOpacity applies to node");

    opacity.setEnabled(false);
    checkNear(node._getLocalOpacity(), 1.F, "UIOpacity disable resets node opacity");

    opacity.setOpacity(64.F);
    checkNear(opacity.getOpacity(), 64.F, "disabled UIOpacity stores its new value");
    checkNear(node._getLocalOpacity(), 1.F, "disabled UIOpacity mutation preserves neutral node opacity");

    opacity.setEnabled(true);
    checkNear(node._getLocalOpacity(), 64.F / 255.F, "UIOpacity enable applies the value saved while disabled");
    opacity.setOpacity(128.F);
    cc::Node next("next-opacity-host");
    opacity.setNode(&next);
    checkNear(node._getLocalOpacity(), 1.F, "moving UIOpacity restores its previous host");
    checkNear(next._getLocalOpacity(), 128.F / 255.F, "moving UIOpacity applies to its new host");
    opacity.detach();
    checkNear(next._getLocalOpacity(), 1.F, "detaching UIOpacity restores its host");
    {
        cc::UIOpacity temporary(&next);
        temporary.setOpacity(64.F);
    }
    checkNear(next._getLocalOpacity(), 1.F, "destroying an attached UIOpacity restores its host");
    check(!next.getUIComponent(cc::UIOpacity::TYPE_ID), "destroying UIOpacity clears the borrowed slot");
    {
        cc::Node temporaryHost("short-lived-opacity-host");
        opacity.setNode(&temporaryHost);
    }
    check(!opacity.getNode(), "destroying the host clears the surviving UIOpacity link");
}

void testJsBindings(se::ScriptEngine *scriptEngine) {
    se::Object *globalObject = scriptEngine->getGlobalObject();
    check(globalObject != nullptr, "global object");
    check(jsb_register_global_variables(globalObject), "jsb_register_global_variables");
    check(register_all_engine(globalObject), "register_all_engine");
    // Match production: scene MaterialInstance derives from assets Material.
    check(register_all_assets(globalObject), "register_all_assets");
    check(register_all_scene(globalObject), "register_all_scene");
    check(register_all_scene_manual(globalObject), "register_all_scene_manual");
    check(register_all_native2d(globalObject), "register_all_native2d");
    globalObject->defineFunction("readLabelCoverage", _SE(readLabelCoverage));
    globalObject->defineFunction("readLabelText", _SE(readLabelText));
    globalObject->defineFunction("readRendererEntity", _SE(readRendererEntity));
    globalObject->defineFunction("readRichTextSegment", _SE(readRichTextSegment));
    check(register_platform_bindings(globalObject), "register_platform_bindings");
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    se::Value namespaceValue, loadValue, family;
    const bool loader = globalObject->getProperty("jsb", &namespaceValue) && namespaceValue.isObject()
        && namespaceValue.toObject()->getProperty("loadFont", &loadValue) && loadValue.isObject();
    check(loader, "real platform font loader is registered");
    if (loader) {
        const auto registryBefore = getFontFamilyNameMap().size();
        for (const auto &arguments : {se::ValueArray{}, se::ValueArray{se::Value("MissingSource_LABEL")}}) {
            se::Value result;
            loadValue.toObject()->call(arguments, namespaceValue.toObject(), &result);
            check(!result.isString() && getFontFamilyNameMap().size() == registryBefore, "missing arguments do not register a font");
            scriptEngine->clearException();
        }
        const std::string alias = "M6ReloadFont_LABEL";
        auto load = [&](const std::string &source) {
            se::Value result;
            const se::ValueArray arguments{se::Value(alias), se::Value(source)};
            check(loadValue.toObject()->call(arguments, namespaceValue.toObject(), &result), "font registry call");
            return result.isString();
        };
        check(load(std::string("url('") + CC2D_FONT_FIXTURE + "')"), "font alias initially loads");
        const auto originalPath = getFontFamilyNameMap().at(alias);
        check(!load("url('C:/__cc2d_missing_font_fixture__.ttf')"), "missing absolute font path is rejected");
        check(!load("not-a-font-url"), "malformed font source is rejected");
        check(getFontFamilyNameMap().at(alias) == originalPath, "failed reload preserves previous font path");
        // This fixture owns one temporary directory and file; no recursive deletion.
        // Keep owned fixture files beside the other harness outputs. The
        // system TEMP may be an inaccessible 8.3 path in managed environments.
        const auto directory = std::filesystem::current_path()
            / ("cc2d-font-registry-" + std::to_string(GetCurrentProcessId()) + "-" + std::to_string(GetTickCount64()));
        const bool created = std::filesystem::create_directory(directory);
        check(created, "font reload fixture creates its own directory");
        if (created) {
            const auto replacement = directory / "replacement.ttf";
            check(std::filesystem::copy_file(CC2D_FONT_FIXTURE, replacement), "font reload fixture copies independent source");
            {
                cc::IntrusivePtr<cc::TTFFont> oldFont(new cc::TTFFont()), newFont(new cc::TTFFont());
                oldFont->setFontFamily(alias); oldFont->loadFontData(CC2D_FONT_FIXTURE);
                const auto oldRender = oldFont->getRenderFontFamily();
                check(load("url('" + replacement.generic_string() + "')"), "legacy registration replaces owned public alias");
                newFont->setFontFamily(alias); newFont->loadFontData(replacement.generic_string());
                check(getFontAssetFamilyNameMap().at(oldRender) == originalPath,
                      "old font keeps its source after same-name replacement");
                const auto newRender = newFont->getRenderFontFamily();
                oldFont->destroy();
                check(getFontFamilyNameMap().at(alias) == replacement.generic_string()
                          && getFontAssetFamilyNameMap().count(newRender) == 1,
                      "old font destruction cannot remove a newer alias generation");
                newFont->destroy();
                check(!getFontFamilyNameMap().count(alias) && !getFontAssetFamilyNameMap().count(newRender),
                      "last owner of replacement source releases its aliases");
            }
            {
                cc::IntrusivePtr<cc::TTFFont> oldFont(new cc::TTFFont()), newFont(new cc::TTFFont());
                oldFont->setFontFamily(alias); oldFont->loadFontData(CC2D_FONT_FIXTURE);
                newFont->setFontFamily(alias); newFont->loadFontData(replacement.generic_string());
                newFont->destroy();
                check(getFontFamilyNameMap().at(alias) == originalPath,
                      "releasing newest font generation restores a still-owned source");
                oldFont->destroy();
                check(!getFontFamilyNameMap().count(alias), "last older font releases restored alias");
            }
            check(load("url('" + replacement.generic_string() + "')"), "font alias reload succeeds");
            check(getFontFamilyNameMap().at(alias) == replacement.generic_string(), "same alias now selects replacement path");
            check(getFontFamilyNameMap().size() == registryBefore + 1, "same alias reload does not grow registry");
            for (int iteration = 0; iteration < 1000; ++iteration) {
                const auto &path = iteration % 2 == 0 ? originalPath : replacement.generic_string();
                check(load("url('" + path + "')"), "repeated font alias reload succeeds");
                check(getFontFamilyNameMap().at(alias) == path && getFontFamilyNameMap().size() == registryBefore + 1,
                      "repeated reload replaces exactly one registry entry");
            }
            {
                cc::CanvasRenderingContext2D canvas(1, 1);
                canvas.setFont("24px " + alias);
                checkNear(canvas.measureText("Atlas 123").width, 95.9765625F, "reloaded alias selects real custom font");
            }
            // Restore a persistent source before removing the owned fixture.
            check(load(std::string("url('") + CC2D_FONT_FIXTURE + "')"), "alias reload restores source");
            check(std::filesystem::remove(replacement), "font reload releases source file handles");
            check(std::filesystem::remove(directory), "font reload removes empty fixture directory");
        }
        const se::ValueArray arguments{se::Value("M6StrokeFont_LABEL"), se::Value(std::string("url('") + CC2D_FONT_FIXTURE + "')")};
        check(loadValue.toObject()->call(arguments, namespaceValue.toObject(), &family) && family.isString(), "real loader registers Canvas test font");
        auto capture = [](bool explicitDefaults, bool invalidWidths) {
            cc::CanvasRenderingContext2D canvas(128, 128);
            canvas.setFont("48px M6StrokeFont_LABEL");
            check(canvas.supportsTextStroke(), "registered custom Canvas font advertises native stroke");
            if (explicitDefaults) {
                canvas.setLineWidth(1); canvas.setLineJoin("miter"); canvas.setTextAlign("left");
                canvas.setTextBaseline("alphabetic"); canvas.setStrokeStyle("black");
            }
            if (invalidWidths) {
                canvas.setLineWidth(0); canvas.setLineWidth(-1); canvas.setLineWidth(std::numeric_limits<float>::infinity());
                canvas.setLineWidth(std::numeric_limits<float>::quiet_NaN());
            }
            canvas.strokeText("H", 20, 90, 0);
            std::vector<uint8_t> pixels;
            canvas.setCanvasBufferUpdatedCallback([&](const cc::Data &data) { pixels.assign(data.getBytes(), data.getBytes() + data.getSize()); });
            canvas.fetchData();
            return pixels;
        };
        const auto defaults = capture(false, false), explicitDefaults = capture(true, false), ignoredWidths = capture(false, true);
        check(!defaults.empty() && defaults == explicitDefaults && defaults == ignoredWidths, "Canvas stroke defaults and ignored invalid widths match explicit state");
        bool visible = false;
        for (size_t pixel = 3; pixel < defaults.size(); pixel += 4) if (defaults[pixel]) visible = true;
        check(visible, "default Canvas stroke draws opaque black pixels");
    }
#endif

    const char *script =
        "(function () {"
        "  try {"
        "    if (typeof n2d === 'undefined') return 'n2d undefined';"
        "    var t = new n2d.UITransform();"
        "    t.setContentSizeXY(100, 50);"
        "    t.setAnchorPointXY(0.5, 0.5);"
        "    if (t.getWidth() !== 100) return 'unexpected width';"
        "    if (t.getHeight() !== 50) return 'unexpected height';"
        "    if (t.getBoundingBoxX() !== -50 || t.getBoundingBoxY() !== -25) return 'unexpected bbox origin';"
        "    if (t.getBoundingBoxWidth() !== 100 || t.getBoundingBoxHeight() !== 50) return 'unexpected bbox size';"
        "    if (t.convertToWorldSpaceARX(3, 4) !== 3 || t.convertToWorldSpaceARY(3, 4) !== 4) return 'unexpected world conversion';"
        "    if (t.containsWorldPointXY(0, 0)) return 'unexpected hit';"
        "    if (t.hitTestXY(0, 0)) return 'unexpected screen hit';"
        "    var identity = new jsb.Mat4();"
        "    if (t.getBoundingBoxToX(identity) !== -50) return 'unexpected target bbox x';"
        "    if (t.getBoundingBoxToWidth(identity) !== 100) return 'unexpected target bbox width';"
        "    t.detach();"
        "    var ur = new n2d.UIRenderer();"
        "    ur.setColorRGBA(1, 2, 3, 255);"
        "    ur.setPriority(5);"
        "    var sf = new jsb.SpriteFrame();"
        "    sf.setRect(0, 0, 1, 1);"
        "    sf.setOriginalSize(1, 1);"
        "    sf.setOffset(0, 0);"
        "    sf.setRotated(false);"
        "    sf.setInsets(1, 2, 3, 4);"
        "    var clone = new jsb.SpriteFrame();"
        "    clone.copyFrom(sf);"
        "    clone.setRectWidth(7);"
        "    if (sf.getRectWidth() !== 1 || clone.getRectWidth() !== 7) return 'frame copy shares data';"
        "    if (sf.getInsetTop() !== 3) return 'frame inset order';"
        "    if (sf.getPixelsToUnit() !== 100 || sf.getPivotX() !== 0.5) return 'frame defaults';"
        "    sf.setFlipUVX(true);"
        "    if (!sf.getFlipUVX()) return 'frame flip';"
        "    if (sf.getUV().length !== 0) return 'missing texture UV';"
        "    var texture = new jsb.Texture2D();"
        "    texture.create(128, 256);"
        "    sf.setTexture(texture);"
        "    sf.setRect(7, 11, 40, 28);"
        "    sf.setRotated(true);"
        "    sf.setFlipUVX(false);"
        "    if (sf.getUV().length !== 8 || sf.getSlicedUV().length !== 32) return 'frame UV binding conversion';"
        "    if (Math.abs(sf.getUV()[0] - 7 / 128) > 0.000001) return 'frame UV binding values';"
        "    var packedTexture = new jsb.Texture2D(); packedTexture.create(512, 512);"
        "    sf.setDynamicAtlasFrame(packedTexture, 21, 31);"
        "    if (!sf.hasDynamicAtlasFrame() || sf.getOriginalTexture() !== texture || sf.getOriginalX() !== 7 || sf.getOriginalY() !== 11) return 'atlas original binding';"
        "    clone.copyFrom(sf); clone.resetDynamicAtlasFrame();"
        "    if (clone.getTexture() !== texture || sf.getTexture() !== packedTexture) return 'atlas clone independence';"
        "    sf.resetDynamicAtlasFrame();"
        "    if (sf.hasDynamicAtlasFrame() || sf.getTexture() !== texture || sf.getRectX() !== 7 || sf.getRectY() !== 11) return 'atlas reset binding';"
        "    sf.resetFrame(true);"
        "    if (sf.getRectWidth() !== 0 || sf.getInsetLeft() !== 0) return 'frame reset';"
        "    var atlas = new jsb.SpriteAtlas();"
        "    atlas.addSpriteFrame('icon', sf);"
        "    if (atlas.getSpriteFrameNames().join(',') !== 'icon') return 'unexpected atlas names';"
        "    if (!atlas.getSpriteFrame('icon')) return 'unexpected atlas lookup';"
        "    atlas.setSpriteFrames(['hero', 'empty'], [sf, null]);"
        "    if (atlas.getSpriteFrameNames().join(',') !== 'hero,empty') return 'atlas names conversion';"
        "    if (atlas.getSpriteFrame('hero') !== sf) return 'atlas frame vector conversion';"
        "    if (atlas.getTexture() !== texture) return 'atlas first texture';"
        "    atlas.setSpriteFrameOrder(['empty', 'hero']);"
        "    if (atlas.getTexture() !== null) return 'atlas first null slot texture';"
        "    atlas.clear();"
        "    var entity = new n2d.RenderEntity(0);"
        "    entity.setPriority(73);"
        "    var buffer = entity.getEntitySharedBufferForJS(), priority = new Uint32Array(buffer);"
        "    if (priority[0] !== 73 || entity.getEntitySharedBufferForJS() !== buffer) return 'entity buffer initial state';"
        "    priority[0] = 91;"
        "    if (entity.getPriority() !== 91) return 'entity buffer write';"
        "    entity.setPriority(102);"
        "    if (priority[0] !== 102) return 'entity buffer native write';"
        "    var draw = new n2d.RenderDrawInfo(), attrs = draw.getAttrSharedBufferForJS();"
        "    if (attrs !== draw.getAttrSharedBufferForJS() || draw.isVertexPositionInWorld()) return 'draw buffer initial state';"
        "    new Uint8Array(attrs)[2] |= 2;"
        "    if (!draw.isVertexPositionInWorld()) return 'draw buffer write';"
        "    var s = new n2d.Sprite();"
        "    s.setColorRGBA(255, 128, 0, 255);"
        "    s.setTrim(false);"
        "    var o = new n2d.UIOpacity();"
        "    o.setOpacity(128);"
        "    if (o.getOpacity() !== 128) return 'unexpected opacity';"
        "    o.setActive(false);"
        "    o.setActive(true);"
        "    o.detach();"
        "    var node = new jsb.Node('jsb-node');"
        "    var attached = new n2d.UITransform(node);"
        "    if (attached.getWidth() !== 100) return 'unexpected attached width';"
        "    attached.detach();"
        "    var scene = new jsb.Scene('jsb-scene');"
        "    var sceneNode = new jsb.Node('scene-node');"
        "    scene.addChild(sceneNode);"
        "    sceneNode.setPositionJS(10, 20, 0);"
        "    var sceneTransform = new n2d.UITransform(sceneNode);"
        "    sceneTransform.setContentSizeXY(100, 50);"
        "    if (sceneTransform.getBoundingBoxWidth() !== 100) return 'unexpected scene width';"
        "    if (sceneTransform.getBoundingBoxX() !== -40) return 'unexpected scene position';"
        "    var sceneOpacity = new n2d.UIOpacity(sceneNode);"
        "    sceneOpacity.setOpacity(128);"
        "    sceneOpacity.detach();"
        "    sceneTransform.detach();"
        "    return 'OK';"
        "  } catch (e) { return String(e); }"
        "})()";
    se::Value result;
    const bool ok = scriptEngine->evalString(script, 0, &result);
    std::printf("jsb bindings result: %s\n", result.isString() ? result.toString().c_str() : "<not string>");
    std::fflush(stdout);
    check(ok && result.isString() && result.toString() == "OK", "jsb n2d.UITransform/Sprite bindings");
}

void testJsSceneRecord(se::ScriptEngine *scriptEngine) {
    const char *record = R"JSON({
        "name": "root",
        "position": [10, 20],
        "size": [100, 50],
        "anchor": [0.5, 0.5],
        "opacity": 128,
        "children": [
            {
                "name": "child",
                "position": [100, 0],
                "size": [50, 50],
                "anchor": [0.5, 0.5],
                "opacity": 64,
                "opacityFirst": true,
                "children": [
                    { "name": "grandchild", "position": [50, 0], "size": [20, 20], "anchor": [0.5, 0.5] }
                ]
            }
        ]
    })JSON";

    std::string script = R"JS(
(function () {
    var record = )JS";
    script += record;
    script += R"JS(;
    function load(record, parent) {
        var node = new jsb.Node(record.name);
        parent.addChild(node);
        if (record.position) node.setPositionJS(record.position[0], record.position[1], 0);
        var transform = null;
        var opacity = null;
        function createOpacity() {
            if (record.opacity !== undefined && opacity === null) {
                opacity = new n2d.UIOpacity(node);
                opacity.setOpacity(record.opacity);
            }
        }
        if (record.opacityFirst) createOpacity();
        if (record.size) {
            transform = new n2d.UITransform(node);
            transform.setContentSizeXY(record.size[0], record.size[1]);
            if (record.anchor) transform.setAnchorPointXY(record.anchor[0], record.anchor[1]);
        }
        createOpacity();
        var children = [];
        (record.children || []).forEach(function (child) {
            children.push(load(child, node));
        });
        return { node: node, transform: transform, opacity: opacity, children: children };
    }
    var scene = new jsb.Scene('scene-record');
    var root = load(record, scene);
    if (!root.transform) return 'missing root transform';
    if (root.transform.getBoundingBoxToWorldX() !== -40) return 'unexpected record bbox x';
    if (root.transform.getBoundingBoxToWorldWidth() !== 175) return 'unexpected record bbox width';
    if (root.transform.getBoundingBoxToWorldHeight() !== 50) return 'unexpected record bbox height';
    if (!root.opacity || root.opacity.getOpacity() !== 128) return 'unexpected record opacity';
    if (!root.children[0].transform || root.children[0].transform.getBoundingBoxWidth() !== 50) return 'unexpected child width';
    if (!root.children[0].opacity || root.children[0].opacity.getOpacity() !== 64) return 'unexpected child opacity';
    if (!root.children[0].children[0].transform || root.children[0].children[0].transform.getBoundingBoxWidth() !== 20) return 'unexpected grandchild width';

    var cloneRecord = JSON.parse(JSON.stringify(record));
    cloneRecord.name = 'clone';
    cloneRecord.position = [-10, 0];
    cloneRecord.size = [40, 40];
    cloneRecord.opacity = 32;
    cloneRecord.children = [];
    var cloneRoot = load(cloneRecord, scene);
    if (cloneRoot.transform.getBoundingBoxToWorldX() !== -30) return 'unexpected clone bbox x';
    if (cloneRoot.transform.getBoundingBoxToWorldWidth() !== 40) return 'unexpected clone bbox width';
    if (cloneRoot.opacity.getOpacity() !== 32) return 'unexpected clone opacity';
    if (root.transform.getBoundingBoxToWorldWidth() !== 175) return 'original changed after clone';
    if (root.opacity.getOpacity() !== 128) return 'original opacity changed after clone';
    return 'OK';
})()
)JS";

    se::Value result;
    const bool ok = scriptEngine->evalString(script.c_str(), static_cast<uint32_t>(script.size()), &result);
    std::printf("jsb scene record: %s\n", result.isString() ? result.toString().c_str() : "<not string>");
    std::fflush(stdout);
    check(ok && result.isString() && result.toString() == "OK", "jsb scene record attach");
}

void testDirtyRenderers() {
    class Probe final : public cc::UIRenderer {
    public:
        std::function<void()> run;
        bool clearAfterCallback{false};
        void invalidate() { markRenderDirty(); }
        void invalidateColor() { markRenderDirty(COLOR); }
        uint32_t pending() const { return renderDirtyFlags(); }
        void updateRenderer() override {
            if (!clearAfterCallback) clearRenderDirty();
            run();
            if (clearAfterCallback) clearRenderDirty();
        }
    };
    auto &manager = cc::UIRendererManager::getInstance();
    int updates = 0;
    {
        cc::Node node("dirty-renderer");
        Probe renderer;
        renderer.run = [&] { ++updates; };
        renderer.invalidate();
        manager.updateAllDirtyRenderers();
        check(updates == 0, "detached renderer defers its update");
        renderer.setNode(&node);
        renderer.invalidate();
        renderer.invalidate();
        manager.updateAllDirtyRenderers();
        check(updates == 1, "repeated mutations dispatch once");
        renderer.invalidate();
        renderer.setEnabled(false);
        renderer.invalidate();
        manager.updateAllDirtyRenderers();
        check(updates == 1, "disabled renderer defers pending work");
        renderer.setEnabled(true);
        manager.updateAllDirtyRenderers();
        check(updates == 2, "enable dispatches deferred work");
        renderer.invalidate();
        renderer.setNode(nullptr);
        manager.updateAllDirtyRenderers();
        check(updates == 2, "detach cancels queued work");
        renderer.setNode(&node);
        renderer.invalidate();
    }
    manager.updateAllDirtyRenderers();
    check(updates == 2, "destruction cancels queued work");
    // Removing the next item cancels its pending entry. Appends during a callback
    // are visited in the same pass; marks before an update still coalesce.
    cc::Node root("manager-parity");
    Probe first, second, third, fourth;
    for (auto *item : {&first, &second, &third, &fourth}) item->setNode(&root);
    std::vector<int> order;
    first.run = [&] {
        order.push_back(1);
        second.setEnabled(false);
        second.setEnabled(true);
        manager.markDirtyRenderer(&fourth);
        manager.markDirtyRenderer(&second);
    };
    second.run = [&] { order.push_back(2); };
    third.run = [&] { order.push_back(3); };
    fourth.run = [&] { order.push_back(4); };
    for (auto *item : {&first, &second, &third, &first}) manager.markDirtyRenderer(item);
    manager.updateAllDirtyRenderers();
    check(order == std::vector<int>{1, 3, 4, 2}, "native update order matches TS live dirty array");
    manager.markDirtyRenderer(&second);
    manager.updateAllDirtyRenderers();
    manager.updateAllDirtyRenderers();
    check(order == std::vector<int>{1, 3, 4, 2, 2}, "version advances and idle pass skips clean renderers");

    for (const bool removeCurrent : {true, false}) {
        Probe a, b, c;
        for (auto *item : {&a, &b, &c}) item->setNode(&root);
        std::vector<int> visited;
        a.run = [&] {
            visited.push_back(1);
            if (removeCurrent) a.setEnabled(false);
        };
        b.run = [&] {
            visited.push_back(2);
            if (!removeCurrent) a.setEnabled(false);
            manager.updateAllDirtyRenderers(); // Recursive flush must not consume the live queue.
        };
        c.run = [&] { visited.push_back(3); };
        for (auto *item : {&a, &b, &c}) manager.markDirtyRenderer(item);
        manager.updateAllDirtyRenderers();
        check(visited == std::vector<int>{1, 2, 3},
              removeCurrent ? "self removal preserves every remaining dirty renderer"
                            : "removing an updated renderer preserves outstanding queue indices");
    }


    {
        Probe renderer;
        renderer.setNode(&root);
        renderer.clearAfterCallback = true;
        int count = 0;
        renderer.run = [&] {
            if (++count == 1) {
                renderer.invalidateColor();
                renderer.invalidateColor();
            }
        };
        renderer.invalidate();
        manager.updateAllDirtyRenderers();
        check(count == 1 && renderer.pending() == 2, "self invalidation survives the update's trailing dirty clear");
        manager.updateAllDirtyRenderers();
        check(count == 2 && renderer.pending() == 0, "self invalidation updates exactly once in the next flush");
        manager.updateAllDirtyRenderers();
        check(count == 2, "deferred update becomes idle after consuming its flags");
    }
    {
        Probe a, b;
        a.setNode(&root); b.setNode(&root);
        int count = 0;
        a.run = [&] { ++count; };
        b.run = [&] { a.invalidateColor(); a.invalidateColor(); };
        a.invalidate(); b.invalidate();
        manager.updateAllDirtyRenderers();
        check(count == 1 && a.pending() == 2, "later renderer preserves invalidation of an already updated renderer");
        manager.updateAllDirtyRenderers();
        check(count == 2 && a.pending() == 0, "cross-renderer invalidation is consumed in the next flush");
    }
    {
        Probe renderer;
        renderer.setNode(&root);
        int count = 0;
        renderer.run = [&] {
            if (++count == 1) {
                renderer.setEnabled(false);
                renderer.invalidate();
                renderer.setEnabled(true);
            }
        };
        renderer.invalidate();
        manager.updateAllDirtyRenderers();
        check(count == 1, "disable-enable during update cannot repeat within the current flush");
        manager.updateAllDirtyRenderers();
        check(count == 2, "disable-enable preserves the deferred update");
    }
    {
        auto a = std::make_unique<Probe>();
        Probe b;
        a->setNode(&root); b.setNode(&root);
        int count = 0;
        a->run = [&] { ++count; a->invalidateColor(); };
        b.run = [&] { a.reset(); };
        a->invalidate(); b.invalidate();
        manager.updateAllDirtyRenderers();
        manager.updateAllDirtyRenderers();
        check(count == 1 && !a, "destruction cancels an already queued deferred update");
    }

}

void testRendererLayoutOwnership() {
    {
        cc::Node shared("replaced-renderer"), next("moved-renderer");
        cc::Graphics current;
        {
            cc::Sprite former;
            former.setNode(&shared);
            current.setNode(&shared);
            check(shared.getUserData() == current.getRenderEntity(), "replacement renderer owns the active entity slot");
            former.setNode(&next);
            check(shared.getUserData() == current.getRenderEntity(), "moving an older renderer preserves the active entity");
            check(next.getUserData() == former.getRenderEntity(), "moved renderer publishes its entity on the new node");
        }
        check(!next.getUserData(), "destroying the active renderer clears its entity slot");
        current.setNode(nullptr);
        check(!shared.getUserData(), "explicit detach clears the active entity slot");
    }
    cc::Sprite sprite;
    cc::Node first("first-layout"), second("second-layout");
    cc::UITransform original(&first);
    sprite.setNode(&first);
    sprite.setUITransform(&original);
    sprite.setNode(&second);
    check(sprite.getUITransform() == nullptr, "moving Sprite drops the old node layout");
    sprite.setFrame(makeSquareFrame(nullptr, 17.F));
    cc::UITransform replacement;
    cc::UIOpacity opacity;
    int callbacks = 0;
    replacement.setSizeChangedCallback([&](float, float) {
        ++callbacks;
        opacity.setNode(&second);
    });
    replacement.setNode(&second);
    check(sprite.getUITransform() == &replacement, "late layout attaches to Sprite");
    check(callbacks == 0, "binding a late layout defers its resize callback");
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    check(replacement.getWidth() == 17.F && callbacks == 1 && opacity.getNode() == &second,
          "late layout applies Sprite size mode and permits component edits in its resize callback");
    check(original.getWidth() == 100.F, "Sprite size mode leaves the former layout untouched");
    replacement.detach();
    check(sprite.getUITransform() == nullptr, "removing a live layout unbinds Sprite");
    sprite.setNode(&first);
    check(sprite.getUITransform() == &original, "moving back rebinds the current node layout");
    cc::Label label;
    {
        cc::Node transient("transient-layout");
        original.setNode(&transient);
        sprite.setNode(&transient);
        label.setNode(&transient);
        label.setString("before");
        label.updateRenderData();
    }
    check(sprite.getUITransform() == nullptr, "node destruction clears the surviving Sprite layout");
    original.setContentSize(137.F, 43.F);
    label.setString("after node destruction");
    label.updateRenderData(true);
    check(original.getWidth() == 137.F && original.getHeight() == 43.F, "detached Label cannot resize its former layout");
}

void testSpritePrepare() {
    cc::Node node("native-sprite");
    cc::UITransform transform(&node);
    transform.setContentSize(100.F, 100.F);

    auto *texture = new cc::Texture2D();
    texture->create(1, 1, cc::Texture2D::PixelFormat::RGBA8888);
    auto *material = new cc::Material();

    cc::Sprite sprite;
    sprite.setNode(&node);
    sprite.setUITransform(&transform);
    sprite.setMaterial(material);
    check(sprite.getRenderMaterial() == material, "ui renderer material");
    auto *material2 = new cc::Material();
    sprite.setSharedMaterial(material2, 1);
    check(sprite.getSharedMaterial(1) == material2, "ui renderer shared material");
    check(sprite.getSharedMaterial(0) == material, "ui renderer shared material zero");
    check(sprite.getMaterialInstance(0)->getParent() == material, "ui renderer creates a native material instance");
    check(sprite.getTypeId() == cc::Sprite::TYPE_ID, "sprite type id");
    sprite.setColorRGBA(10.F, 20.F, 30.F, 255.F);
    sprite.setPriority(7);
    sprite.setSizeMode(0);
    sprite.setFrame(makeSquareFrame(texture, 1.F));

    cc::Node sizeNode("native-sprite-size-mode");
    cc::UITransform sizeTransform(&sizeNode);
    sizeTransform.setContentSize(100.F, 100.F);
    cc::Sprite sizeSprite;
    sizeSprite.setNode(&sizeNode);
    sizeSprite.setUITransform(&sizeTransform);
    auto *sizeFrame = new cc::SpriteFrame();
    sizeFrame->setTexture(texture);
    sizeFrame->setRect(0.F, 0.F, 50.F, 60.F);
    sizeFrame->setOriginalSize(80.F, 90.F);
    sizeSprite.setSizeMode(1);
    sizeSprite.setFrame(sizeFrame);
    check(sizeTransform.getContentSize().x == 50.F && sizeTransform.getContentSize().y == 60.F,
          "sprite trimmed size mode uses frame rect");
    sizeSprite.setSizeMode(2);
    check(sizeTransform.getContentSize().x == 80.F && sizeTransform.getContentSize().y == 90.F,
          "sprite raw size mode uses original size");

    cc::RenderEntity *entity = sprite.getRenderEntity();
    check(entity != nullptr, "sprite render entity");
    if (entity == nullptr) {
        return;
    }
    // The manager prepares draw information before the scene walk.
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    const auto color = entity->getColor();
    check(color.r == 10 && color.g == 20 && color.b == 30 && color.a == 255, "sprite submits its renderer color");
    check(entity->getPriority() == 7, "sprite submits its renderer priority");
    check(entity->getStaticDrawInfoSize() == 1, "sprite draw info count");
    if (entity->getStaticDrawInfoSize() != 1) {
        return;
    }
    cc::RenderDrawInfo *drawInfo = entity->getStaticRenderDrawInfo(0);
    check(drawInfo != nullptr, "sprite draw info");
    if (drawInfo != nullptr) {
        check(drawInfo->getVbCount() == 4, "sprite vertex count");
        check(drawInfo->getIbCount() == 6, "sprite index count");
        check(drawInfo->getMaterial() == sprite.getRenderMaterial(), "sprite uses active material instance");
        check(drawInfo->getTexture() == texture->getGFXTexture(), "sprite texture");
    }

    {
        cc::IntrusivePtr<cc::Node> parent(new cc::Node("sprite-ancestor"));
        cc::IntrusivePtr<cc::Node> child(new cc::Node("sprite-child"));
        child->setParent(parent);
        cc::UITransform ui(child);
        cc::Sprite peer;
        peer.setNode(child);
        peer.setUITransform(&ui);
        peer.setMaterial(material);
        peer.setSizeMode(0);
        cc::IntrusivePtr<cc::SpriteFrame> shared(new cc::SpriteFrame());
        shared->setTexture(texture);
        shared->setRect(0, 0, 1, 1);
        peer.setFrame(shared);
        auto *peerEntity = peer.getRenderEntity();
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        auto *draw = peerEntity->getStaticRenderDrawInfo(0);
        check(draw && draw->getVbCount() == 4, "child starts with prepared quad");
        if (!draw || !drawInfo) return;
        const float initialX = draw->getVDataBuffer()[0];
        parent->setPosition(17.F, 0.F, 0.F);
        child->getWorldMatrix(); // A different consumer can clear Node transform flags first.
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(draw->getVDataBuffer()[0], initialX + 17.F, "ancestor motion updates cached positions before traversal");
        child->setActiveInHierarchy(true);
        peer.setEnabled(true);
        parent->setActiveInHierarchy(true);
        parent->_setLocalOpacity(.5F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        {
            cc::Batcher2d batcher;
            batcher.walk(parent, 1.F, false);
        }
        checkNear(draw->getVDataBuffer()[8], .5F, "inherited opacity updates vertex alpha");
        peer.setColorRGBA(64, 128, 192, 255);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        for (uint32_t v = 0; v < draw->getVbCount(); ++v) {
            const auto *rgba = draw->getVDataBuffer() + v * draw->getStride() + 5;
            checkNear(rgba[0], 64.F / 255.F, "tint updates red on each vertex");
            checkNear(rgba[1], 128.F / 255.F, "tint updates green on each vertex");
            checkNear(rgba[2], 192.F / 255.F, "tint updates blue on each vertex");
            checkNear(rgba[3], .5F, "tint preserves inherited alpha");
        }
        peer.setColorRGBA(255, 0, 0, 255);
        parent->setPosition(23.F, 0.F, 0.F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(draw->getVDataBuffer()[0], initialX + 23.F, "a pending tint cannot mask dirty geometry");
        checkNear(draw->getVDataBuffer()[6], 0.F, "geometry rebuild applies concurrent tint");
        texture->setFilters(cc::Filter::NEAREST, cc::Filter::NEAREST);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(draw->getSampler() == texture->getGFXSampler() && drawInfo->getSampler() == texture->getGFXSampler(), "both consumers bind replacement sampler");
        texture->create(2, 2, cc::Texture2D::PixelFormat::RGBA8888);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        check(draw->getTexture() == texture->getGFXTexture() && drawInfo->getTexture() == texture->getGFXTexture(), "both consumers bind replacement texture view");
        checkNear(draw->getVDataBuffer()[12], .5F, "resized texture recomputes frame UV");
        checkNear(drawInfo->getVDataBuffer()[12], .5F, "resized texture recomputes second consumer UV");
        peer.setSizeMode(0);
        peer.setFrame(makeSquareFrame(texture, 1.F));
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        // A geometry update rewrites this UV even if the resulting frame is identical.
        const float oldU = draw->getVDataBuffer()[12];
        draw->getVDataBuffer()[12] = -1.F;
        shared->setRectWidth(.5F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        checkNear(draw->getVDataBuffer()[12], -1.F, "changing a former frame leaves the prepared vertices untouched");
        draw->getVDataBuffer()[12] = oldU;
        texture->create(1, 1, cc::Texture2D::PixelFormat::RGBA8888);
        child->setParent(nullptr);
    }

    // Mutating a shared native frame must invalidate idle sprites without
    // JS reassigning spriteFrame. Check real render buffers in all five modes.
    cc::IntrusivePtr<cc::SpriteFrame> mutableFrame(new cc::SpriteFrame());
    mutableFrame->setTexture(texture);
    mutableFrame->setOriginalSize(1.F, 1.F);
    mutableFrame->setRect(0.F, 0.F, 1.F, 1.F);
    cc::Sprite otherSprite;
    cc::Node otherNode("shared-frame");
    cc::UITransform otherTransform(&otherNode);
    otherTransform.setContentSize(100.F, 100.F);
    otherSprite.setNode(&otherNode);
    otherSprite.setUITransform(&otherTransform);
    otherSprite.setMaterial(material);
    otherSprite.setSizeMode(0);
    sprite.setSizeMode(0);
    sprite.setFrame(mutableFrame);
    otherSprite.setFrame(mutableFrame);
    sprite.setFillRange(1.F); // Filled tests must request a nonempty interval.
    for (int mode = 0; mode < 5; ++mode) {
        sprite.setType(mode < 3 ? mode : 3);
        sprite.setFillType(mode == 4 ? 2 : 0);
        mutableFrame->setFlipUVX(false);
        mutableFrame->setRectWidth(1.F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        mutableFrame->setRectWidth(0.5F);
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        if (mode == 2) {
            // 100 x 100 content over 0.5 x 1 requires 20,000 quads.
            check(entity->getStaticDrawInfoSize() == 0, "oversized tiling clears stale draw info");
            transform.setContentSize(80.F, 80.F);
            cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        }
        otherSprite.prepare(1.F);
        auto *info = entity->getStaticDrawInfoSize() == 1 ? entity->getStaticRenderDrawInfo(0) : nullptr;
        check(info && info->getVbCount() > 0, "frame revision rebuilds all sprite modes");
        if (info) {
            const float *vertices = info->getVDataBuffer();
            for (uint32_t i = 0; i < info->getVbCount(); ++i) {
                check(vertices[i * 9 + 3] <= 0.50001F, "in-place rect mutation updates native UV");
            }
        }
        if (mode == 2) transform.setContentSize(100.F, 100.F);
    }
    sprite.setType(0);
    mutableFrame->setFlipUVX(true);
    sprite.prepare(1.F);
    checkNear(entity->getStaticRenderDrawInfo(0)->getVDataBuffer()[3], 0.5F, "flip mutation rebuilds idle sprite");
    checkNear(otherSprite.getRenderEntity()->getStaticRenderDrawInfo(0)->getVDataBuffer()[12], 0.5F,
              "shared frame mutation reaches second sprite");
    mutableFrame->setTexture(nullptr);
    sprite.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 0, "cleared texture removes stale draw info");
    mutableFrame->setTexture(texture);
    sprite.prepare(1.F);
    check(entity->getStaticDrawInfoSize() == 1, "resolved texture restores draw info");
    mutableFrame->setRect(0.25F, 0.125F, 0.5F, 0.25F);
    for (int flags = 0; flags < 8; ++flags) {
        mutableFrame->setRotated((flags & 1) != 0);
        mutableFrame->setFlipUVX((flags & 2) != 0);
        mutableFrame->setFlipUVY((flags & 4) != 0);
        for (int type = 0; type < 2; ++type) {
            sprite.setType(type);
            sprite.prepare(1.F);
            const auto expected = type == 0 ? mutableFrame->getUV() : mutableFrame->getSlicedUV();
            const auto *info = entity->getStaticRenderDrawInfo(0);
            const float *vertices = info->getVDataBuffer();
            check(info->getVbCount() * 2 == expected.size(), "Sprite and asset UV layouts agree");
            for (uint32_t i = 0; i < info->getVbCount(); ++i) {
                checkNear(vertices[i * 9 + 3], expected[i * 2], "Sprite consumes frame rotation/flip U convention");
                checkNear(vertices[i * 9 + 4], expected[i * 2 + 1], "Sprite consumes frame rotation/flip V convention");
            }
        }
    }

    cc::Node slicedNode("native-sprite-sliced");
    cc::UITransform slicedTransform(&slicedNode);
    slicedTransform.setContentSize(200.F, 200.F);
    cc::Sprite slicedSprite;
    slicedSprite.setNode(&slicedNode);
    slicedSprite.setUITransform(&slicedTransform);
    slicedSprite.setMaterial(material);
    slicedSprite.setType(1);
    auto *slicedFrame = new cc::SpriteFrame();
    slicedFrame->setTexture(texture);
    slicedFrame->setRect(0.F, 0.F, 1.F, 1.F);
    slicedFrame->setOriginalSize(1.F, 1.F);
    slicedFrame->setInsets(0.F, 0.F, 0.F, 0.F);
    slicedSprite.setFrame(slicedFrame);
    cc::RenderEntity *slicedEntity = slicedSprite.getRenderEntity();
    check(slicedEntity != nullptr, "sliced sprite render entity");
    if (slicedEntity != nullptr) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        cc::RenderDrawInfo *slicedDrawInfo = slicedEntity->getStaticRenderDrawInfo(0);
        check(slicedDrawInfo != nullptr, "sliced sprite draw info");
        if (slicedDrawInfo != nullptr) {
            check(slicedDrawInfo->getVbCount() == 16, "sliced sprite vertex count");
            check(slicedDrawInfo->getIbCount() == 54, "sliced sprite index count");
        }
    }

    cc::Node filledNode("native-sprite-filled");
    cc::UITransform filledTransform(&filledNode);
    filledTransform.setContentSize(100.F, 100.F);
    cc::Sprite filledSprite;
    filledSprite.setNode(&filledNode);
    filledSprite.setUITransform(&filledTransform);
    filledSprite.setMaterial(material);
    filledSprite.setType(3);
    filledSprite.setFillType(0);
    filledSprite.setFillStart(0.25F);
    filledSprite.setFillRange(0.5F);
    filledSprite.setSizeMode(0);
    filledSprite.setFrame(makeSquareFrame(texture, 1.F));
    cc::RenderEntity *filledEntity = filledSprite.getRenderEntity();
    check(filledEntity != nullptr, "filled sprite render entity");
    if (filledEntity != nullptr) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        cc::RenderDrawInfo *filledDrawInfo = filledEntity->getStaticRenderDrawInfo(0);
        check(filledDrawInfo != nullptr, "filled sprite draw info");
        if (filledDrawInfo != nullptr) {
            check(filledDrawInfo->getVbCount() == 4, "filled sprite vertex count");
            check(filledDrawInfo->getIbCount() == 6, "filled sprite index count");
        }
    }

    cc::Node tiledNode("native-sprite-tiled");
    cc::UITransform tiledTransform(&tiledNode);
    tiledTransform.setContentSize(200.F, 100.F);
    cc::Sprite tiledSprite;
    tiledSprite.setNode(&tiledNode);
    tiledSprite.setUITransform(&tiledTransform);
    tiledSprite.setMaterial(material);
    tiledSprite.setType(2);
    tiledSprite.setSizeMode(0);
    tiledSprite.setFrame(makeSquareFrame(texture, 100.F));
    cc::RenderEntity *tiledEntity = tiledSprite.getRenderEntity();
    check(tiledEntity != nullptr, "tiled sprite render entity");
    if (tiledEntity != nullptr) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        cc::RenderDrawInfo *tiledDrawInfo = tiledEntity->getStaticRenderDrawInfo(0);
        check(tiledDrawInfo != nullptr, "tiled sprite draw info");
        if (tiledDrawInfo != nullptr) {
            check(tiledDrawInfo->getVbCount() == 8, "tiled sprite vertex count");
            check(tiledDrawInfo->getIbCount() == 12, "tiled sprite index count");
        }
    }

    cc::Node radialNode("native-sprite-radial");
    cc::UITransform radialTransform(&radialNode);
    radialTransform.setContentSize(100.F, 100.F);
    cc::Sprite radialSprite;
    radialSprite.setNode(&radialNode);
    radialSprite.setUITransform(&radialTransform);
    radialSprite.setMaterial(material);
    radialSprite.setType(3);
    radialSprite.setFillType(2);
    radialSprite.setFillStart(0.F);
    radialSprite.setFillRange(0.5F);
    radialSprite.setFillCenter(0.5F,0.5F);
    radialSprite.setSizeMode(0);
    radialSprite.setFrame(makeSquareFrame(texture, 1.F));
    cc::RenderEntity *radialEntity = radialSprite.getRenderEntity();
    check(radialEntity != nullptr, "radial sprite render entity");
    if (radialEntity != nullptr) {
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
        cc::RenderDrawInfo *radialDrawInfo = radialEntity->getStaticRenderDrawInfo(0);
        check(radialDrawInfo != nullptr, "radial sprite draw info");
        if (radialDrawInfo != nullptr) {
            check(radialDrawInfo->getVbCount() == 9, "radial sprite vertex count");
            check(radialDrawInfo->getIbCount() == 9, "radial sprite index count");
        }
    }

    constexpr int kPrepareIterations = 10000;
    const auto start = std::chrono::steady_clock::now();    for (int i = 0; i < kPrepareIterations; ++i) {
        sprite.setDirty();
        cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    }
    const auto elapsed = std::chrono::steady_clock::now() - start;
    const auto nanos = std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count();
    std::printf("native sprite prepare: %.1f ns/op\n",
                static_cast<double>(nanos) / static_cast<double>(kPrepareIterations));
}

size_t getWorkingSetBytes() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    PROCESS_MEMORY_COUNTERS counters{};
    if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) {
        return static_cast<size_t>(counters.WorkingSetSize);
    }
#endif
    return 0;
}

void writeSpriteQuadJson() {
    cc::SimpleSpriteGeometryParams params;
    params.contentSize = cc::Vec2(100.F, 100.F);
    params.anchorPoint = cc::Vec2(0.5F, 0.5F);
    params.frameRect = cc::Rect(0.F, 0.F, 100.F, 100.F);
    params.textureSize = cc::Vec2(100.F, 100.F);
    params.originalSize = cc::Vec2(100.F, 100.F);
    params.trim = false;

    const cc::SpriteQuad quad = cc::buildSimpleSpriteQuad(params);
    std::ofstream out("native-sprite-quad.json");
    if (!out) {
        return;
    }
    out << "{\n  \"stride\": 9,\n  \"vertices\": [\n";
    for (int i = 0; i < 4; ++i) {
        out << "    [" << quad.vertices[i].position.x << ", " << quad.vertices[i].position.y
            << ", 0, " << quad.vertices[i].uv.x << ", " << quad.vertices[i].uv.y
            << ", 255, 255, 255, 255]";
        out << (i == 3 ? "\n" : ",\n");
    }
    out << "  ],\n  \"indices\": [";
    for (int i = 0; i < 6; ++i) {
        out << static_cast<int>(quad.indices[i]) << (i == 5 ? "" : ", ");
    }
    out << "]\n}\n";
}

void testSpriteSceneBenchmark() {
    constexpr int kSpriteCount = 1000;
    const size_t memoryBefore = getWorkingSetBytes();
    std::vector<std::unique_ptr<cc::Node>> nodes;
    std::vector<std::unique_ptr<cc::UITransform>> transforms;
    std::vector<std::unique_ptr<cc::Sprite>> sprites;
    nodes.reserve(kSpriteCount);
    transforms.reserve(kSpriteCount);
    sprites.reserve(kSpriteCount);

    auto *texture = new cc::Texture2D();
    texture->create(1, 1, cc::Texture2D::PixelFormat::RGBA8888);
    auto *material = new cc::Material();

    const auto frame = makeSquareFrame(texture, 1.F);
    for (int i = 0; i < kSpriteCount; ++i) {
        auto node = std::make_unique<cc::Node>("sprite");
        node->setPosition(static_cast<float>(i % 40) * 10.F, static_cast<float>(i / 40) * 10.F, 0.F);
        node->updateWorldTransform();
        auto transform = std::make_unique<cc::UITransform>(node.get());
        transform->setContentSize(32.F, 32.F);
        auto sprite = std::make_unique<cc::Sprite>();
        sprite->setNode(node.get());
        sprite->setUITransform(transform.get());
        sprite->setMaterial(material);
        sprite->setSizeMode(0);
        sprite->setFrame(frame);

        nodes.emplace_back(std::move(node));
        transforms.emplace_back(std::move(transform));
        sprites.emplace_back(std::move(sprite));
    }

    const auto start = std::chrono::steady_clock::now();
    for (auto &sprite : sprites) {
        sprite->setDirty();
    }
    cc::UIRendererManager::getInstance().updateAllDirtyRenderers();
    const auto elapsed = std::chrono::steady_clock::now() - start;
    const auto nanos = std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count();
    std::printf("native sprite scene: %d sprites, %.1f us total, %.1f ns/sprite\n",
                kSpriteCount,
                static_cast<double>(nanos) / 1000.0,
                static_cast<double>(nanos) / static_cast<double>(kSpriteCount));

    const size_t memoryAfter = getWorkingSetBytes();
    if (memoryBefore != 0 && memoryAfter > memoryBefore) {
        std::printf("native heap delta: %.1f KB total, %.0f bytes/sprite\n",
                    static_cast<double>(memoryAfter - memoryBefore) / 1024.0,
                    static_cast<double>(memoryAfter - memoryBefore) / static_cast<double>(kSpriteCount));
    }
}

} // namespace

int main(int argc, char **argv) {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    if (argc == 2 && std::string(argv[1]) == "--directwrite-file-probe") return runDirectWriteFileProbe();
    if (argc == 2 && std::string(argv[1]) == "--canvas-text-shadow-probe") {
        testTextShadowCrop();
        std::printf("Canvas text shadow: %s\n", gFailures == 0 ? "PASS" : "FAIL");
        return gFailures == 0 ? 0 : 1;
    }
#endif
    if (argc == 4 && std::string(argv[1]) == "--log-visibility-probe") {
        // A quiet child must expose completed log records before it exits.
        // The ready file establishes that both production log calls returned.
        setvbuf(stdout, nullptr, _IOFBF, 4096);
        cc::Log::logMessage(cc::LogType::KERNEL, cc::LogLevel::INFO, "M6_LOG_VISIBLE kernel");
        cc::Log::logMessage(cc::LogType::SCRIPT, cc::LogLevel::WARN, "M6_LOG_VISIBLE script");
        { std::ofstream ready(argv[2]); ready << "ready"; }
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
        while (!std::filesystem::exists(argv[3]) && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        return std::filesystem::exists(argv[3]) ? 0 : 2;
    }
    setvbuf(stdout, nullptr, _IONBF, 0);
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    _set_error_mode(_OUT_TO_STDERR);
    _set_abort_behavior(0, _WRITE_ABORT_MSG | _CALL_REPORTFAULT);
#endif
    // Node's shared-memory bridge needs a running script engine; Root/Device
    // are required by the surrounding engine singletons.
    cc::Root *root = new cc::Root(cc::gfx::DeviceManager::create());
    cc::BuiltinResMgr builtins;
    auto *scriptEngine = new se::ScriptEngine();
    auto *files = cc::createFileUtils();
    scriptEngine->start();
    {
        se::AutoHandleScope scope;
        testSpriteAtlas();
        testSpriteFrameData();
        testFrameConsumers();
        testUiBatchInputResources();
        testBitmapGpuGeometry();
        testFontAssets();
        testLabelEntityColor();
        testFontAliasOwnership();
        testTextStroke();
        testTextShadowCrop();
        testLabelStyleExtents();
        testLabelRasterMapping();
        testCharLabelRasterReuse();
        testRichTextParser();
        testRichTextLayout();
        testLayoutAndMaterials();
        testGraphicsMeshes();
        testMaskHitLifecycle();
        testRootRegistrationLifecycle();
        testSpriteApiAndMaterials();
        std::printf("sprite atlas done\n");
        std::fflush(stdout);
        testUITransform();
        testUITransformParity();
        testUITransformScaleParity();
        testUITransformChildBounds();
        testUITransformRotatedParity();
        testComponentAttach();
        testUIOpacity();
        std::printf("uitransform done\n");
        std::fflush(stdout);
        try {
            testJsBindings(scriptEngine);
            testRichTextRuntime();
            testRichTextRetainedWrappers(scriptEngine);
        } catch (const std::exception &error) {
            ++gFailures;
            std::printf("FAIL: JSB binding test exception: %s\n", error.what());
        }
        if (argc > 1) {
            std::ifstream stream(argv[1]);
            const std::string script((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
            se::Value result;
            const bool ok = !script.empty() && scriptEngine->evalString(script.c_str(), static_cast<uint32_t>(script.size()), &result);
            check(ok && result.isString() && result.toString() == "OK", "JSB shell integration probe");
            std::printf("jsb shell integration: %s\n", result.isString() ? result.toString().c_str() : "FAIL");
        }
        testJsSceneRecord(scriptEngine);
        std::printf("jsb bindings done\n");
        std::fflush(stdout);
        testSpriteGeometry();
        writeSpriteQuadJson();
        std::printf("geometry done\n");
        std::fflush(stdout);
        testDirtyRenderers();
        testRendererLayoutOwnership();
        testSpritePrepare();
        std::printf("sprite prepare done\n");
        std::fflush(stdout);
        testSpriteSceneBenchmark();
        std::printf("sprite scene benchmark done\n");
        std::fflush(stdout);
    }
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    cc::IntrusivePtr<cc::TTFFont> lateFont(new cc::TTFFont());
    lateFont->setFontFamily("M6LateFont_LABEL"); lateFont->loadFontData(CC2D_FONT_FIXTURE);
#endif
    scriptEngine->cleanup();
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    check(getFontFamilyNameMap().empty(), "script cleanup releases Windows font aliases");
    check(getFontAssetFamilyNameMap().empty(), "script cleanup releases owned font render aliases");
    check(!getFontAliasLeaseCount() && !getFontAliasGroupCount(), "script cleanup releases font lease and generation records");
    {
        cc::IntrusivePtr<cc::TTFFont> freshFont(new cc::TTFFont());
        freshFont->setFontFamily("M6LateFont_LABEL"); freshFont->loadFontData(CC2D_FONT_FIXTURE);
        lateFont->clearNativeData();
        check(getFontAliasLeaseCount() == 1 && getFontAliasGroupCount() == 1
                  && getFontFamilyNameMap().count("M6LateFont_LABEL") == 1,
              "late release after cleanup cannot remove a new generation");
    }
    lateFont = nullptr;
    check(getFontFamilyNameMap().empty() && getFontAssetFamilyNameMap().empty()
              && !getFontAliasLeaseCount() && !getFontAliasGroupCount(), "post-cleanup font owners release all registry records");
#endif
    delete scriptEngine;
    delete root;
    delete files;

    std::printf("native 2D PoC: %s\n", gFailures == 0 ? "PASS" : "FAIL");
    return gFailures == 0 ? 0 : 1;
}
