"""Local preview server with explicit ES-module MIME types on Windows."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8795);a=p.parse_args()
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.webp':'image/webp'}
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(Path(__file__).resolve().parents[2]),**kwargs)
    def end_headers(self):self.send_header('Cache-Control','no-cache');super().end_headers()
ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
