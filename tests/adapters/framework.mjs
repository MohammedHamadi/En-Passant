export class NextRequest extends Request {
  constructor(url, options) {
    super(url, options);
    this.nextUrl = new URL(url);
    this.cookies = {
      get: name => {
        const item = (this.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s
          .startsWith(name + '='));
        return item ? {
          value: item.slice(name.length + 1)
        } : undefined;
      }
    };
  }
}
export class NextResponse extends Response {
  constructor(body, options) {
    super(body, options);
    this.cookies = {
      set: (name, value, opts) => this.headers.append('set-cookie',
        `${name}=${value}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=${opts.maxAge}; Path=${opts.path}${opts.secure?'; Secure':''}`
      )
    };
  }
  static json(value, options = {}) {
    return new NextResponse(JSON.stringify(value), {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...options.headers
      }
    });
  }
}
export function after(callback) {
  globalThis.__epRouteTest.after.push(callback);
}
