# auto-cms

Auto turn any webpage into editable CMS without coding.

[![npm Package Version](https://img.shields.io/npm/v/auto-cms-server)](https://www.npmjs.com/package/auto-cms-server)

## Features

- [x] Click with `Ctrl` key or `Alt` key to show menu
- [x] Edit from web UI
  - text
  - link
  - image
  - audio
  - video
- [x] media management
  - [x] view
  - [x] upload
  - [x] delete
  - [ ] see which pages are using the media
  - [x] support image
  - [x] support video / audio
- [x] Reuse html template
  - For common header, footer, e.t.c.
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
  - convert 150+ languages with [node-EasyNMT](https://github.com/beenotung/node-EasyNMT)
  - convert traditional Chinese / simplified Chinese with [繁化姬 API](https://docs.zhconvert.org)
- [x] Contact form
- [x] IFrame inlining
- [ ] Auto scan 404
- [x] Auto setup `.env` file
- [x] Robust
  - Correctly set Content-Type even when the filename of the HTML file is not ending with `.html`
  - Auto backup edits
  - View and restore from backups

## Enhancement

- [x] support editing element with multiple text nodes with br
- [ ] remove duplicated script, style and css link caused by repeated runtime script injection

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

### Multi Language

The `LANG` cookie is used to specified the client-preferred language. Possible values are: `en`, `zh_cn`, and `zh_hk`.

The default value can be set in the environment variable `AUTO_CMS_DEFAULT_LANG`.

Example UI and code to set the language see the `langForm` in [example/footer.html](./example/footer.html)

### Submit Contact Form

```
Method: POST
Pathname: /contact
Content-Type: application/x-www-form-urlencoded or application/json
Accept: text/html or application/json
Body Fields:
- name
- email
- tel
- company_name
- business_nature
- remark
- extra
```

All body fields are optional.

If you submit additional fields in the request body, they will be stored as JSON in the `extra` field.

If the `Accept` is `application/json`, the response will be a json object with optional `error` string; otherwise the response will be a html page.

The response file can be configured in the env variable `SUBMIT_CONTACT_RESULT_PAGE`. If it is not specified, or specified as `default`, a simple html page will be response as below:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Submitted</title>
  </head>
  <body>
    <p>Your submission has been received.</p>
    ${error ? `
    <pre><code>${escapeHTML(error)}</code></pre>
    ` : ''}
    <p>Back to <a href="/">home page</a>.</p>
  </body>
</html>
```

If you want to implement custom form submission experience, you can do that with AJAX like below example:

```html
<form method="POST" action="/contact" onsubmit="submitContact(event)">
  <h1>Contact Form</h1>
  <div class="contact-form--field">
    <label>
      Nickname: <input type="text" name="name" autocomplete="nickname" />
    </label>
  </div>
  <div class="contact-form--field">
    <label>
      Email: <input type="email" name="email" autocomplete="email" />
    </label>
  </div>
  <div>
    <input type="submit" value="Submit" />
  </div>
  <div class="contact-form--submit-result"></div>
</form>
<script>
  async function submitContact(event) {
    let form = event.target
    let result = form.querySelector('.contact-form--submit-result')
    function showResult(text) {
      result.textContent = text
    }
    try {
      let formData = new FormData(form)
      let params = new URLSearchParams(formData)
      let body = params.toString()
      event.preventDefault()
      let res = await fetch('/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body,
      })
      let json = await res.json()
      if (json.error) throw json.error
      showResult('Thank you. Your submission is received.')
    } catch (error) {
      showResult(String(error))
    }
  }
</script>
```

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
