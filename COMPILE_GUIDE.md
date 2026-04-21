# 编译说明

## 安装TypeScript编译器

在项目根目录执行：

```bash
npm install
```

## 编译TypeScript

```bash
# 编译
npm run build

# 或监听文件变化自动编译
npm run watch
```

## 使用编译后的文件

编译完成后，将生成的 `dist/script.js` 复制到项目目录：

```bash
cp dist/script.js ./script.js
```

然后更新 `index.html` 中的引用：

```html
<script src="/static/script.js"></script>
```

## 开发模式

建议使用 VS Code 的 TypeScript 插件，可以获得实时类型检查和代码提示。

## 注意事项

- 原始TypeScript源文件在 `script.ts`
- 编译后的JavaScript在 `dist/script.js`
- 请勿直接修改 `dist/script.js`，修改后会被编译覆盖
