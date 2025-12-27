# Fuck or Not

基于 `Google Gemini AI` 的"上不上"图片分析网站。

## 使用

访问 [Fuck or Not](https://fuckornot.netlify.app/)。

1. 选择分析模式（简洁、详细、小说）
2. 上传图片（大于 20MB 请选择「使用 FileAPI 上传图片」）
3. 点击「分析」按钮，等待结果

你可以收藏满意的分析结果，它们会保存在浏览器的 `IndexedDB` 中，可在收藏夹页面查看。

## 设置

在设置页填入你的 API 密钥，[点此获取](https://aistudio.google.com/app/apikey)。

- **自定义 Prompt**：可为各个模式自定义 Prompt，或添加全新的自定义 Prompt
- **自定义模型列表**：可添加、编辑或删除模型。[点此查看](https://aistudio.google.com/usage?tab=rate-limit) Gemini 当前支持的模型，也可点击“重置为默认”以获取当前可能的模型列表

## 模型

~~体感最好的应该是 **Gemini 2.0 Flash**，它不容易被安全过滤器禁止，且效果跟 **Gemini 2.5 Flash** 相当。~~

> [!IMPORTANT]
> Gemini 2.0 Flash 已停止支持。现有模型的安全过滤器较为严格，若被禁止请尝试修改 Prompt 或更换图片。
