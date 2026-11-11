/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#include "2d/assets/SpriteAtlas.h"

#include "2d/assets/SpriteFrame.h"

namespace cc {

void SpriteAtlas::addSpriteFrame(const ccstd::string &name, SpriteFrame *frame) {
    if (frame == nullptr) {
        _spriteFrames.erase(name);
        return;
    }
    _spriteFrames[name] = frame;
}

SpriteFrame *SpriteAtlas::getSpriteFrame(const ccstd::string &name) const {
    const auto it = _spriteFrames.find(name);
    return it == _spriteFrames.end() ? nullptr : it->second.get();
}

void SpriteAtlas::removeSpriteFrame(const ccstd::string &name) {
    _spriteFrames.erase(name);
}

void SpriteAtlas::clear() {
    _spriteFrames.clear();
}

TextureBase *SpriteAtlas::getTexture() const {
    for (const auto &entry : _spriteFrames) {
        if (entry.second != nullptr) {
            return entry.second->getTexture();
        }
    }
    return nullptr;
}

} // namespace cc
