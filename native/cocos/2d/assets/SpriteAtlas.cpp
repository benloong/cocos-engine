/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#include "2d/assets/SpriteAtlas.h"

#include "2d/assets/SpriteFrame.h"
#include <algorithm>

namespace cc {

void SpriteAtlas::addSpriteFrame(const ccstd::string &name, SpriteFrame *frame) {
    if (_spriteFrames.find(name) == _spriteFrames.end()) _frameNames.emplace_back(name);
    // A null value is still a named slot, matching the serialized JS map.
    _spriteFrames[name] = frame;
    ++_revision;
}

SpriteFrame *SpriteAtlas::getSpriteFrame(const ccstd::string &name) const {
    const auto it = _spriteFrames.find(name);
    return it == _spriteFrames.end() ? nullptr : it->second.get();
}

void SpriteAtlas::removeSpriteFrame(const ccstd::string &name) {
    _spriteFrames.erase(name);
    _frameNames.erase(std::remove(_frameNames.begin(), _frameNames.end(), name), _frameNames.end());
    ++_revision;
}

void SpriteAtlas::clear() {
    _spriteFrames.clear();
    _frameNames.clear();
    ++_revision;
}

void SpriteAtlas::setSpriteFrames(const ccstd::vector<ccstd::string> &names, const ccstd::vector<SpriteFrame *> &frames) {
    CC_ASSERT(names.size() == frames.size());
    if (names.size() != frames.size()) return;
    ccstd::unordered_map<ccstd::string, IntrusivePtr<SpriteFrame>> replacement;
    for (size_t i = 0; i < names.size(); ++i) {
        replacement[names[i]] = frames[i];
    }
    // Retain all new frames before releasing old ones, including when a frame
    // is merely renamed or several names share the same object.
    _spriteFrames.swap(replacement);
    _frameNames = names;
    ++_revision;
}

TextureBase *SpriteAtlas::getTexture() const {
    // JS Object.keys order is supplied by the shell. Web uses the first slot,
    // including a null/empty-texture frame, rather than searching for any texture.
    auto *frame = _frameNames.empty() ? nullptr : getSpriteFrame(_frameNames.front());
    return frame ? frame->getTexture() : nullptr;
}

} // namespace cc
