"""Loopback-only static server with gzip, ETags, and no directory listing."""
import argparse,gzip,hashlib,mimetypes
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlsplit
ROOT=Path(__file__).resolve().parent/'public'
CACHE={}
class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):self.respond(False)
    def do_GET(self):self.respond(True)
    def respond(self,body):
        target=(ROOT/(unquote(urlsplit(self.path).path).lstrip('/') or 'index.html')).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file() or target.suffix not in {'.html','.js','.css','.json','.svg','.png','.ico'}:
            self.send_error(404);return
        stamp=target.stat().st_mtime_ns
        key=(str(target),stamp,'gzip' in self.headers.get('Accept-Encoding',''))
        if key not in CACHE:
            raw=target.read_bytes();etag='"'+hashlib.sha256(raw).hexdigest()[:24]+'"'
            use_gzip=key[2] and len(raw)>1024
            CACHE[key]=(gzip.compress(raw,mtime=0) if use_gzip else raw,etag,use_gzip)
            if len(CACHE)>300:CACHE.pop(next(iter(CACHE)))
        payload,etag,zipped=CACHE[key]
        status=304 if self.headers.get('If-None-Match')==etag else 200
        self.send_response(status)
        self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding')
        immutable=target.is_relative_to(ROOT/'data') and target.parent!=ROOT/'data'
        self.send_header('Cache-Control','public,max-age=31536000,immutable' if immutable else 'no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        if status==200:
            self.send_header('Content-Type',(mimetypes.guess_type(target)[0] or 'application/octet-stream')+'; charset=utf-8')
            self.send_header('Content-Length',str(len(payload)))
            if zipped:self.send_header('Content-Encoding','gzip')
        self.end_headers()
        if body and status==200:self.wfile.write(payload)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8876);args=p.parse_args()
    print(f'PDV dashboard: http://127.0.0.1:{args.port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
