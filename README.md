# Fuck or Not

上不上 AI 分析网站，基于 `Google Gemini AI`。

## 使用

访问 [Fuck or Not](https://fuckornot.netlify.app/)。

选择你想要的分析类型（简洁、详细、小说模式）并上传你的图片（如果图片大于 20 MB，请选择 `使用 FileAPI 上传图片`）。

点击分析按钮，等待结果。

你可以收藏你满意的分析结果，它将保存在浏览器的 `IndexedDB` 中，你可以在收藏夹页面看到它们。

## 设置

在设置页，填入你自己的 `API` 密钥，[此处获取](https://aistudio.google.com/app/apikey)。

你可以自定义各个模式的 `Prompt`，或者添加一个自定义的 `Prompt`。

## 模型

体感最好的应该是 **Gemini 2.0 Flash** ，它不容易被安全过滤器禁止，且效果跟 **Gemini 2.5 Flash** 相当。
