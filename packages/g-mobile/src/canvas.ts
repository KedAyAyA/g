import { AbstractCanvas, CanvasCfg } from '@antv/g-base';
import { ChangeType } from '@antv/g-base';
import { IElement } from './interfaces';
import { getShape } from './util/hit';
import * as Shape from './shape';
import Group from './group';
import { each, getPixelRatio, tick, clearAnimationFrame } from './util/util';
import { applyAttrsToContext, drawChildren, getMergedRegion, mergeView, checkRefresh, clearChanged } from './util/draw';
import EventController from './events';
import CanvasProxy from './util/mini-canvas-proxy';
import miniPatch from './patch';

class Canvas extends AbstractCanvas {
  constructor(cfg: CanvasCfg) {
    super(cfg);

    if (this.get('renderer') === 'mini') {
      this.set('context', new Proxy(this.get('context'), new CanvasProxy()));
      // 架构调整前，打一些patch
      miniPatch(this.get('context'));
    }
  }
  public getDefaultCfg() {
    const cfg = super.getDefaultCfg();
    // 设置渲染引擎为 canvas(h5)/mini(小程序)，只读属性
    cfg['renderer'] = 'canvas';
    // 是否自动绘制，不需要用户调用 draw 方法
    cfg['autoDraw'] = true;
    // 是否允许局部刷新图表
    cfg['localRefresh'] = false;
    cfg['refreshElements'] = [];
    // 是否在视图内自动裁剪
    cfg['clipView'] = true;
    // 是否使用快速拾取的方案，默认为 false，上层可以打开
    cfg['quickHit'] = false;
    return cfg;
  }

  /**
   * @protected
   * 初始化绑定的事件
   */
  initEvents() {
    const eventController = new EventController({
      canvas: this,
    });
    this.set('eventController', eventController);
  }

  public registerEventCallback(e): void {
    const eventController = this.get('eventController');
    eventController.handleEvent(e);
  }

  /**
   * @protected
   * 清理所有的事件
   */
  clearEvents() {
    const eventController = this.get('eventController');
    eventController.destroy();
  }

  /**
   * 一些方法调用会引起画布变化
   * @param {ChangeType} changeType 改变的类型
   */
  onCanvasChange(changeType: ChangeType) {
    /**
     * 触发画布更新的三种 changeType
     * 1. attr: 修改画布的绘图属性
     * 2. sort: 画布排序，图形的层次会发生变化
     * 3. changeSize: 改变画布大小
     */
    if (changeType === 'attr' || changeType === 'sort' || changeType === 'changeSize') {
      this.draw();
    }
  }

  getShapeBase() {
    return Shape;
  }

  getGroupBase() {
    return Group;
  }
  /**
   * 获取屏幕像素比
   */
  getPixelRatio() {
    const pixelRatio = this.get('pixelRatio') || getPixelRatio();
    // 不足 1 的取 1，超出 1 的取整
    return pixelRatio >= 1 ? Math.ceil(pixelRatio) : 1;
  }

  getViewRange() {
    return {
      minX: 0,
      minY: 0,
      maxX: this.cfg.width,
      maxY: this.cfg.height,
    };
  }

  initDom() {
    if (this.get('renderer') === 'mini') {
      const context = this.get('context');
      const pixelRatio = this.getPixelRatio();
      // 设置 canvas 元素的宽度和高度，会重置缩放，因此 context.scale 需要在每次设置宽、高后调用
      if (pixelRatio > 1) {
        context.scale(pixelRatio, pixelRatio);
      }
      return;
    }
    super.initDom();
  }

  // 复写基类的方法生成标签
  createDom(): HTMLElement {
    const element = document.createElement('canvas');
    const context = element.getContext('2d');
    // 缓存 context 对象
    this.set('context', context);
    return element;
  }

  setDOMSize(width: number, height: number) {
    super.setDOMSize(width, height);
    const context = this.get('context');
    const el = this.get('el');
    const pixelRatio = this.getPixelRatio();
    el.width = pixelRatio * width;
    el.height = pixelRatio * height;
    // 设置 canvas 元素的宽度和高度，会重置缩放，因此 context.scale 需要在每次设置宽、高后调用
    if (pixelRatio > 1) {
      context.scale(pixelRatio, pixelRatio);
    }
  }

  // 复写基类方法
  clear() {
    super.clear();
    const context = this.get('context');
    context.clearRect(0, 0, this.get('width'), this.get('height'));
  }

  getShape(x: number, y: number) {
    let shape;
    if (this.get('quickHit')) {
      shape = getShape(this, x, y);
    } else {
      shape = super.getShape(x, y, null);
    }
    return shape;
  }
  // 对绘制区域边缘取整，避免浮点数问题
  _getRefreshRegion() {
    const elements = this.get('refreshElements');
    const viewRegion = this.getViewRange();
    let region;
    // 如果是当前画布整体发生了变化，则直接重绘整个画布
    if (elements.length && elements[0] === this) {
      region = viewRegion;
    } else {
      region = getMergedRegion(elements);
      if (region) {
        region.minX = Math.floor(region.minX);
        region.minY = Math.floor(region.minY);
        region.maxX = Math.ceil(region.maxX);
        region.maxY = Math.ceil(region.maxY);
        region.maxY += 1; // 在很多环境下字体的高低会不一致，附加一像素，避免残影
        const clipView = this.get('clipView');
        // 自动裁剪不在 view 内的区域
        if (clipView) {
          region = mergeView(region, viewRegion);
        }
      }
    }
    return region;
  }

  draw() {
    const context = this.get('context');
    const children = this.getChildren() as IElement[];
    context.clearRect(0, 0, this.get('width'), this.get('height'));
    applyAttrsToContext(context, this);
    drawChildren(context, children);

    // 针对小程序需要手动调用一次draw方法
    if (this.get('renderer') === 'mini') {
      context.draw();
    }
  }

  skipDraw() {}
}

export default Canvas;