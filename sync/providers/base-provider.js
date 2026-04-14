// sync/providers/base-provider.js

export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  async authorize() {
    throw new Error(`[${this.name}] authorize() not implemented`);
  }

  async revoke() {
    throw new Error(`[${this.name}] revoke() not implemented`);
  }

  async getStatus() {
    throw new Error(`[${this.name}] getStatus() not implemented`);
  }
}
