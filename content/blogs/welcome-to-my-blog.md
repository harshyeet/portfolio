---
title: "welcome to my blog & notes"
date: 2026-08-01
draft: false
summary: "an introduction to my technical blog, notes on cybersecurity research, reverse engineering, and web systems."
---

welcome to my new blog space! this blog is built with hugo and rendered directly from plain markdown files.

## why markdown?

writing writeups in markdown allows seamless formatting for:

- code snippets with syntax highlighting
- security advisories and exploit analyses
- clean, lightweight reading experiences without bloated javascript

### sample code block

```python
# quick socket connection test in python
import socket

def test_host(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2.0)
        result = s.connect_ex((host, port))
        if result == 0:
            print(f"[+] port {port} is open on {host}")
        else:
            print(f"[-] port {port} is closed on {host}")

if __name__ == "__main__":
    test_host("127.0.0.1", 80)
```

> "security is not a product, but a process." — bruce schneier

stay tuned for upcoming research and technical deep dives!
