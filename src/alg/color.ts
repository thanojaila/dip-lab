import { countComponents, num, str, type Runner } from './common';

const VIEWS = ['mask', 'red', 'green', 'blue', 'hue', 'sat', 'val'] as const;

export const color: Record<string, Runner> = {
  /** C01: channels and HSV. Hue is 0–180 in OpenCV (degrees / 2) and wraps around. */
  C01: ({ cv, input, params }) => {
    if (input.channels() !== 3) throw new Error('This concept needs a colour image.');
    const view = str(params, 'view');
    const center = num(params, 'hue');
    const width = num(params, 'width');
    const sMin = num(params, 'satMin');
    const vMin = num(params, 'valMin');
    const hsv = new cv.Mat();
    const planes = new cv.MatVector();
    const hsvPlanes = new cv.MatVector();
    const maskA = new cv.Mat();
    const maskB = new cv.Mat();
    const mask = new cv.Mat();
    let out: InstanceType<typeof cv.Mat> | null = null;
    try {
      cv.cvtColor(input, hsv, cv.COLOR_RGB2HSV);
      let lo = center - width;
      let hi = center + width;
      const ranges: [number, number][] = [];
      if (lo < 0) {
        ranges.push([0, hi], [180 + lo, 180]);
      } else if (hi > 180) {
        ranges.push([lo, 180], [0, hi - 180]);
      } else ranges.push([lo, hi]);
      lo = Math.max(0, lo);
      hi = Math.min(180, hi);
      const mk = (r: [number, number], dst: typeof maskA) => {
        const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(Math.round(r[0]), sMin, vMin, 0));
        const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(Math.round(r[1]), 255, 255, 255));
        try {
          cv.inRange(hsv, low, high, dst);
        } finally {
          low.delete();
          high.delete();
        }
      };
      mk(ranges[0], maskA);
      if (ranges[1]) {
        mk(ranges[1], maskB);
        cv.bitwise_or(maskA, maskB, mask);
      } else maskA.copyTo(mask);
      const cc = countComponents(cv, mask, 150);
      cv.split(input, planes);
      cv.split(hsv, hsvPlanes);
      if (view === 'mask') {
        out = new cv.Mat();
        const dim = new cv.Mat();
        try {
          cv.cvtColor(input, dim, cv.COLOR_RGB2GRAY);
          cv.cvtColor(dim, out, cv.COLOR_GRAY2RGB);
          out.convertTo(out, -1, 0.35, 0);
          input.copyTo(out, mask);
        } finally {
          dim.delete();
        }
      } else {
        const idx = { red: planes, green: planes, blue: planes, hue: hsvPlanes, sat: hsvPlanes, val: hsvPlanes }[view as 'red'];
        const k = { red: 0, green: 1, blue: 2, hue: 0, sat: 1, val: 2 }[view as 'red'];
        out = idx.get(k).clone();
        if (view === 'hue') out.convertTo(out, -1, 255 / 180, 0);
      }
      const rangeText = ranges.map((r) => `${Math.round(r[0])}–${Math.round(r[1])}`).join(' and ');
      return {
        mat: out,
        vars: { hueRanges: rangeText, wraps: ranges.length > 1 ? 'The hue range wraps around the 0/180 seam, so two ranges are combined' : 'The hue range does not cross the 0/180 seam', view, blobs: cc.kept, specks: cc.total - cc.kept },
        metrics: { blobs: cc.kept, components: cc.total },
        summary: `${cc.kept} colour blobs of at least 150 pixels found.`,
      };
    } catch (e) {
      out?.delete();
      throw e;
    } finally {
      hsv.delete();
      planes.delete();
      hsvPlanes.delete();
      maskA.delete();
      maskB.delete();
      mask.delete();
    }
  },
};
export { VIEWS };
