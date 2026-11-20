import { USE_JS_GRAPHICS_MASK } from 'internal:constants';
import { Vec2 } from '../../core/math/vec2';
import { Vec3 } from '../../core/math/vec3';
import type { Node } from '../../scene-graph/node';
import { NodeEventProcessor } from '../../scene-graph/node-event-processor';
import type { Mask } from '../components/mask';

const worldPosition = new Vec3();
const maskPoint = new Vec2();

export function testAncestorMasks (node: Node, point: Vec2): boolean {
    const maskClass = NodeEventProcessor._maskComp;
    if (!maskClass) return true;
    for (let ancestor: Node | null = node; ancestor; ancestor = ancestor.parent) {
        const mask = ancestor.getComponent(maskClass) as Mask | null;
        if (mask?.enabledInHierarchy && !mask.isHit(point)) return false;
    }
    return true;
}

interface NativeHitTest {
    containsWorldPointXY (x: number, y: number): boolean;
    hitTestXY (x: number, y: number, windowId: number): boolean;
    getHitTestWorldPointXY (x: number, y: number, windowId: number): Vec2;
}

export function hitTestWithNativeTransform (node: Node, transform: NativeHitTest, point: Vec2, windowId: number, worldPoint?: Vec2): boolean {
    if (!USE_JS_GRAPHICS_MASK) {
        if (!worldPoint) return transform.hitTestXY(point.x, point.y, windowId);
        const hit = transform.getHitTestWorldPointXY(point.x, point.y, windowId);
        if (!Number.isFinite(hit.x) || !Number.isFinite(hit.y)) return false;
        worldPoint.set(hit);
        return true;
    }
    const cameras = node.scene?.renderScene?.cameras;
    if (!cameras) return false;
    for (const camera of cameras) {
        if (!camera || !(camera.visibility & node.layer) || camera.systemWindowId !== windowId
            || (camera.window && !camera.window.swapchain)) continue;
        worldPosition.set(point.x, point.y, 0);
        camera.screenToWorld(worldPosition, worldPosition);
        if (transform.containsWorldPointXY(worldPosition.x, worldPosition.y)
            && testAncestorMasks(node, maskPoint.set(worldPosition.x, worldPosition.y))) {
            worldPoint?.set(maskPoint);
            return true;
        }
    }
    return false;
}
