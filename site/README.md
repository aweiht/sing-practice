# 随声练网站

这里包含随声练的中文介绍页和使用文档，使用 Next.js App Router 与 Tailwind 构建静态页面。网站源码目前没有部署，也没有官网域名。

## 本地开发与构建

在仓库根目录执行：

```sh
npm --prefix site ci
npm --prefix site run dev       # http://localhost:3080
npm --prefix site run build     # 静态文件写入 site/out/
```

也可以先进入 `site/` 再执行 `npm ci`、`npm run dev` 或 `npm run build`。构建网站只会生成文档静态文件，不会构建 Mac 应用。

## 内容与隐私

网站默认使用简体中文和本机系统字体，不加载原站统计脚本、外部演示视频或原作者个人联系入口。源码仓库地址和网站元信息在 `lib/site.ts` 中设置；当前 `siteUrl` 暂用 GitHub 仓库地址，不表示网站已经部署。

产品基于 Daniel Murrell 的 `dsmurrell/onkey`（OnKey）改编。上游 MIT 许可证及第三方声明保留在仓库根目录；模型和依赖的许可证详情见“致谢与许可”页面。
