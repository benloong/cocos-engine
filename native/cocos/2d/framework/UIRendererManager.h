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

#pragma once

#include "base/RefCounted.h"
#include <cstdint>
#include <vector>

namespace cc {

class UIRenderer;

// Stable slots allow native components to cancel or acknowledge work in O(1).
// A slot is valid from addRenderer to removeRenderer, on the game thread.
class UIRendererManager final : public RefCounted {
public:
    uint32_t addRenderer() {
        if (_free == NONE) {
            _slots.emplace_back();
            return static_cast<uint32_t>(_slots.size() - 1);
        }
        const auto id = _free;
        _free = _slots[id].nextFree;
        _slots[id] = {};
        return id;
    }
    void removeRenderer(uint32_t id) {
        if (!active(id)) return;
        clearDirtyRenderer(id);
        _slots[id].owner = nullptr;
        _slots[id].active = false;
        _slots[id].nextFree = _free;
        _free = id;
    }
    void markDirtyRenderer(uint32_t id, uint32_t flags) {
        if (!active(id) || !flags) return;
        auto &slot = _slots[id];
        if (!slot.flags) {
            slot.index = static_cast<uint32_t>(_dirty.size());
            _dirty.push_back(id);
        }
        slot.flags |= flags;
    }
    void clearDirtyRenderer(uint32_t id) {
        if (!getDirtyFlags(id)) return;
        auto &slot = _slots[id];
        const auto last = _dirty.back();
        _dirty[slot.index] = last;
        _slots[last].index = slot.index;
        _dirty.pop_back();
        slot.flags = 0;
    }
    uint32_t getDirtyFlags(uint32_t id) const { return active(id) ? _slots[id].flags : 0; }
    uint32_t getDirtyCount() const { return static_cast<uint32_t>(_dirty.size()); }
    std::vector<uint32_t> takeDirtyRenderers() {
        std::vector<uint32_t> result(_dirty);
        for (auto id : _dirty) _slots[id].flags = 0;
        _dirty.clear();
        return result;
    }

    // Traversal acknowledges native entries after preparing their render data.
    // Other consumers can inspect the live collection without draining it.
    static const UIRendererManager &pendingNativeRenderers() { return nativeRenderers(); }
    UIRenderer *getDirtyNativeRenderer(uint32_t index) const {
        return index < _dirty.size() ? _slots[_dirty[index]].owner : nullptr;
    }
private:
    friend class UIRenderer;
    static UIRendererManager &nativeRenderers() {
        static UIRendererManager manager;
        return manager;
    }
    uint32_t addNativeRenderer(UIRenderer *owner) {
        const auto id = addRenderer();
        _slots[id].owner = owner;
        return id;
    }
    static constexpr uint32_t NONE = UINT32_MAX;
    struct Slot {
        UIRenderer *owner{nullptr}; // borrowed until removeRenderer
        uint32_t index{0};
        uint32_t flags{0};
        uint32_t nextFree{NONE};
        bool active{true};
    };
    bool active(uint32_t id) const { return id < _slots.size() && _slots[id].active; }
    std::vector<Slot> _slots;
    std::vector<uint32_t> _dirty;
    uint32_t _free{NONE};
};

} // namespace cc
