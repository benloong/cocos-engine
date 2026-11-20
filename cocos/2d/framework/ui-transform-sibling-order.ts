import { JSB } from 'internal:constants';
import { isValid } from '../../core/data/object';
import { DirectorEvent, director } from '../../game/director';
import type { Node } from '../../scene-graph/node';

const pendingParents = new Set<Node>();

export function queueUITransformSiblingOrder (parent: Node | null): void {
    if (parent) pendingParents.add(parent);
}

export function queueUITransformParentChange (this: { node: Node }): void {
    if (!this.node.getComponent('cc.RenderRoot2D')) {
        queueUITransformSiblingOrder(this.node.parent);
    }
}

export function clearUITransformSiblingOrder (): void {
    pendingParents.clear();
}

export function applyUITransformSiblingOrder (): void {
    if (!pendingParents.size) return;
    const parents = Array.from(pendingParents);
    pendingParents.clear();
    for (const parent of parents) {
        if (!isValid(parent, true)) continue;
        const children = parent.children;
        children.sort((a, b) => {
            const difference = (a._getUITransformComp()?.priority ?? 0) - (b._getUITransformComp()?.priority ?? 0);
            return difference === 0 ? a.siblingIndex - b.siblingIndex : difference;
        });
        if (children.some((child, index) => child.siblingIndex !== index)) {
            if (JSB) {
                // Publish the same permutation before either backend notifies order listeners.
                (parent as Node & { _setChildren (children: Node[]): void })._setChildren(children);
            }
            parent.eventProcessor.onUpdatingSiblingIndex();
        }
        parent._updateSiblingIndex();
        parent.emit('childrenSiblingOrderChanged');
    }
}

director.on(DirectorEvent.AFTER_UPDATE, applyUITransformSiblingOrder);
director.on(DirectorEvent.BEFORE_SCENE_LAUNCH, clearUITransformSiblingOrder);
