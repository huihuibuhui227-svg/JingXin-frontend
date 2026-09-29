/*
 * Node 的 `global` 在浏览器里不存在。自建 plotly 部分包用的 `plotly.js/lib/*`
 * 细粒度模块会拉进 CommonJS 依赖（has-hover、has-passive-events 等），
 * 它们内部引用 `global` ⟹ 运行时抛 `ReferenceError: global is not defined`，
 * 四个图表组件全被 ErrorBoundary 兜成空白，而且**构建不报错**（纯运行时静默失败）。
 *
 * ⚠️ 这个模块必须在 main.tsx 里**第一个 import**。
 *    ESM 的 import 声明会被提升，模块体里的语句无法"抢在" import 前执行；
 *    只有把 shim 做成独立模块并排在 import 列表最前面，才能靠
 *    "import 按书写顺序求值"这条语义保证它先跑。
 *    （此前把赋值语句写在 import 之前是错的：那条语句实际在全部 import 之后才执行。）
 *
 * 为什么不用 vite 的 `define: { global: 'globalThis' }`：那是字面文本替换，
 * 会把 `import './styles/global.css'` 里的 global 也换成 globalThis，
 * 变成 `globalThis.css` 导致构建失败（实测踩过）。
 */
(window as unknown as { global: Window }).global = window;

export {};
