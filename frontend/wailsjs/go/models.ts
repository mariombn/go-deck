export namespace action {
	
	export class Spec {
	    type: string;
	    keys?: string[];
	    path?: string;
	    args?: string[];
	    url?: string;
	    steps?: Spec[];
	    obsOp?: string;
	    target?: string;
	    discordOp?: string;
	    targetPage?: string;
	
	    static createFrom(source: any = {}) {
	        return new Spec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.keys = source["keys"];
	        this.path = source["path"];
	        this.args = source["args"];
	        this.url = source["url"];
	        this.steps = this.convertValues(source["steps"], Spec);
	        this.obsOp = source["obsOp"];
	        this.target = source["target"];
	        this.discordOp = source["discordOp"];
	        this.targetPage = source["targetPage"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace config {
	
	export class Position {
	    row: number;
	    col: number;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.row = source["row"];
	        this.col = source["col"];
	    }
	}
	export class Button {
	    id: string;
	    label: string;
	    position: Position;
	    action: action.Spec;
	    icon?: string;
	    color?: string;
	
	    static createFrom(source: any = {}) {
	        return new Button(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.position = this.convertValues(source["position"], Position);
	        this.action = this.convertValues(source["action"], action.Spec);
	        this.icon = source["icon"];
	        this.color = source["color"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class OBSConfig {
	    enabled: boolean;
	    host: string;
	    port: number;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new OBSConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.password = source["password"];
	    }
	}
	export class Integrations {
	    obs: OBSConfig;
	
	    static createFrom(source: any = {}) {
	        return new Integrations(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.obs = this.convertValues(source["obs"], OBSConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Server {
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	    }
	}
	export class Grid {
	    rows: number;
	    cols: number;
	
	    static createFrom(source: any = {}) {
	        return new Grid(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rows = source["rows"];
	        this.cols = source["cols"];
	    }
	}
	export class Page {
	    id: string;
	    name: string;
	    grid: Grid;
	    buttons: Button[];
	
	    static createFrom(source: any = {}) {
	        return new Page(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.grid = this.convertValues(source["grid"], Grid);
	        this.buttons = this.convertValues(source["buttons"], Button);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DeckConfig {
	    pages: Page[];
	    server: Server;
	    integrations: Integrations;
	    grid?: Grid;
	    buttons?: Button[];
	
	    static createFrom(source: any = {}) {
	        return new DeckConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pages = this.convertValues(source["pages"], Page);
	        this.server = this.convertValues(source["server"], Server);
	        this.integrations = this.convertValues(source["integrations"], Integrations);
	        this.grid = this.convertValues(source["grid"], Grid);
	        this.buttons = this.convertValues(source["buttons"], Button);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	

}

export namespace server {
	
	export class NetworkInfo {
	    ips: string[];
	    activeIP: string;
	    port: number;
	    url: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new NetworkInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ips = source["ips"];
	        this.activeIP = source["activeIP"];
	        this.port = source["port"];
	        this.url = source["url"];
	        this.error = source["error"];
	    }
	}

}

