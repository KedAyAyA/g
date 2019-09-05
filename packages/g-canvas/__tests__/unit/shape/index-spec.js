import { expect } from 'chai';
import Shape from '../../../src/shape';

describe('Canvas Shape index', () => {
  it('not undefined', () => {
    const shapeTypeList = [
      'Circle',
      'Ellipse',
      'Image',
      'Line',
      'Marker',
      'Path',
      'Polygon',
      'Polyline',
      'Rect',
      'Text',
    ];
    shapeTypeList.forEach((shapeType) => {
      expect(Shape[shapeType]).not.eql(undefined);
    });
  });
});
