/**
 * plotly 部分包 —— 只注册本项目**实际用到**的 trace 类型。
 *
 * 背景：此前四个图表组件都 `import Plot from 'react-plotly.js'`，它内部指向
 * `plotly.js/dist/plotly.js`（完整包，压缩后 4.35 MB）。实测打包后
 * `RadarChart-*.js` 分块 4.76 MB，是全站体积的绝对大头。
 *
 * ⚠️ 为什么不用现成的部分包 dist（这是踩过的判断点）：
 *   本项目用到的 trace 是 bar / heatmap / scatter / scatterpolar 四种，
 *   而
 *     · plotly.js-basic-dist     只有 scatter/bar/pie —— 缺 heatmap、缺 polar
 *     · plotly.js-cartesian-dist 有 heatmap，但 **不含 polar**
 *       （polar 是独立模块，cartesian 里没有 scatterpolar）
 *   ⟹ **没有任何预打包 dist 能同时满足**，只能自建。
 *
 * 用法：组件里 `import Plot from '@/utils/plotlyBundle'` 代替
 * `import Plot from 'react-plotly.js'`。
 */
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js/lib/core';

import scatter from 'plotly.js/lib/scatter';
import bar from 'plotly.js/lib/bar';
import heatmap from 'plotly.js/lib/heatmap';
import scatterpolar from 'plotly.js/lib/scatterpolar';

// 注册顺序无所谓；重复注册也无害。
Plotly.register([scatter, bar, heatmap, scatterpolar]);

const Plot = createPlotlyComponent(Plotly);

export default Plot;
