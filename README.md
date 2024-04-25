# auto-cms

Auto turn any webpage into editable CMS without coding.

[![npm Package Version](https://img.shields.io/npm/v/auto-cms-server)](https://www.npmjs.com/package/auto-cms-server)

## Features

- [x] Right-click with `Ctrl` key or `Alt` key to show menu
- [x] Edit from web UI
  - text
  - link
  - image
  - audio
  - video
- [ ] media management
  - [x] view
  - [x] upload
  - [x] delete
  - [ ] see which pages are using the media
  - [x] support image
  - [ ] support video / audio
- [ ] style editing
  - text alignment
  - text color
  - font size
  - font family
- [x] SEO settings
  - title
  - description
  - preview image
- [x] Save changes to file
- [x] Custom 404 layout (send `404.html` if exists, otherwise send `index.html`)
- [x] Multi-language support
  - [x] convert 150+ languages with [node-EasyNMT](https://github.com/beenotung/node-EasyNMT)
  - [ ] convert traditional Chinese / simplified Chinese
- [x] Contact form
- [x] IFrame inlining
- [ ] Auto scan 404
- [x] Auto setup `.env` file
- [x] Robust
  - Correctly set Content-Type even when the filename of the HTML file is not ending with `.html`
  - Auto backup edits

## Enhancement

- [x] support editing element with multiple text nodes with br

## Usage

Usage with installation to lock the version:

```bash
npm i -D auto-cms-server
npx auto-cms-server
```

Usage without installation:

```bash
npx -y auto-cms-server
```

## API

The api endpoint of contact form is `POST /contact` expecting `Content-Type` be `application/x-www-form-urlencoded` with below optional fields in request body: `name`, `email`, `tel`, `company_name`, `business_nature`, `remark`.

If you want to store additional information, you may store them as JSON in the `remark` field.

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
