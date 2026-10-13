export class Fault extends Error { constructor(status, message) { super(message); this.status = status } }
