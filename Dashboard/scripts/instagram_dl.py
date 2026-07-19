#!/usr/bin/env python3
"""Baixador Instagram do Sistema Oficial — Playwright + perfil JÁ LOGADO.

Reaproveita o método aprovado (instagram-carrosseis): abre o Instagram num
Chromium com perfil persistente logado e faz scraping do DOM. Estende pra vídeo:
reel/post de vídeo baixa via yt-dlp usando os cookies do MESMO perfil logado
(mais confiável que --cookies-from-browser). Carrossel de imagens = scraping.

Uso:   python instagram_dl.py <url>
Saída: imprime "RESULT=<caminho>" (um .mp4 de vídeo, ou um .zip do carrossel).

Env:
  IG_PROFILE_DIR  perfil persistente logado (default: instagram-carrosseis)
  OUTPUT_DIR      pasta destino (default: .)
  YTDLP_PATH      binário yt-dlp (default: yt-dlp)
  IG_HEADLESS     "1" pra rodar sem janela (default: 0 — janela, como o aprovado)

Roda LOCAL (precisa de navegador + sessão logada) — não no servidor headless.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from playwright.sync_api import sync_playwright

PROFILE = Path(os.environ.get("IG_PROFILE_DIR", r"C:\Users\bruno\instagram-carrosseis\.browser_profile"))
OUTPUT = Path(os.environ.get("OUTPUT_DIR", "."))
YTDLP = os.environ.get("YTDLP_PATH", "yt-dlp")
HEADLESS = os.environ.get("IG_HEADLESS", "0") == "1"

# scraping das imagens de um carrossel (clica no "próximo" e coleta cdninstagram)
JS_IMAGENS = """
async () => {
  const urls = [];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const best = (img) => { const ss = img.getAttribute('srcset');
    return ss ? ss.split(',').pop().trim().split(/\\s+/)[0] : (img.src || ''); };
  const art = document.querySelector('article'); if (!art) return urls;
  const grab = () => { for (const img of art.querySelectorAll('img')) {
    const u = best(img); if (u && u.includes('cdninstagram') && !urls.includes(u)) urls.push(u); } };
  grab();
  for (let i = 0; i < 30; i++) {
    const btn = document.querySelector('button[aria-label="Avançar"], button[aria-label="Next"], button[aria-label="Próximo"]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') break;
    btn.click(); await sleep(400); grab();
  }
  return urls.filter(u => !/video/i.test(u));
}
"""

JS_TEM_VIDEO = "() => !!document.querySelector('article video, video')"


def extrair_shortcode(url: str) -> str | None:
    m = re.search(r"instagram\.com/(?:p|reel|reels|tv)/([^/?#]+)", url)
    return m.group(1) if m else None


def extrair_username(url: str) -> str | None:
    path = urlparse(url.strip()).path.strip("/").split("/")
    if not path or not path[0]:
        return None
    if path[0] in ("p", "reel", "reels", "tv", "stories", "explore", "accounts"):
        return None
    return path[0].lstrip("@")


def escrever_cookies(cookies: list[dict], destino: Path) -> None:
    linhas = ["# Netscape HTTP Cookie File"]
    for c in cookies:
        dom = c.get("domain", "")
        if "instagram" not in dom:
            continue
        inc_sub = "TRUE" if dom.startswith(".") else "FALSE"
        seguro = "TRUE" if c.get("secure") else "FALSE"
        exp = int(c.get("expires") or 0)
        if exp < 0:
            exp = 0
        linhas.append("\t".join([dom, inc_sub, c.get("path", "/"), seguro, str(exp), c["name"], c["value"]]))
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")


def baixar_video(url: str, cookies_txt: Path, base: str) -> str | None:
    args = [
        YTDLP, url, "--cookies", str(cookies_txt), "--no-playlist",
        "-f", "b[ext=mp4]/b", "-o", str(OUTPUT / (base + ".%(ext)s")),
        "--restrict-filenames", "--print", "after_move:filepath",
        "--no-warnings", "--no-simulate",
    ]
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=600)
    except Exception:
        return None
    if p.returncode != 0:
        return None
    linhas = [l for l in p.stdout.strip().splitlines() if l.strip()]
    if linhas and Path(linhas[-1]).exists():
        return linhas[-1]
    return None


def sessao_http(cookies: list[dict]) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                               "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    for c in cookies:
        if "instagram" in c.get("domain", ""):
            s.cookies.set(c["name"], c["value"], domain=c.get("domain", ".instagram.com"))
    return s


def baixar_carrossel(page, http: requests.Session, url: str, base: str) -> str | None:
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1500)
    if "accounts/login" in page.url:
        print("!! Perfil não está logado — abra o instagram-carrosseis e logue uma vez.", file=sys.stderr)
        return None
    urls = page.evaluate(JS_IMAGENS)
    if not urls:
        return None
    tmp = OUTPUT / f"_tmp_{base}"
    tmp.mkdir(parents=True, exist_ok=True)
    n = 0
    for i, u in enumerate(urls, start=1):
        try:
            r = http.get(u, timeout=60)
            r.raise_for_status()
            (tmp / f"{i:02d}.jpg").write_bytes(r.content)
            n += 1
            time.sleep(0.2)
        except Exception:
            pass
    if n == 0:
        shutil.rmtree(tmp, ignore_errors=True)
        return None
    zip_base = OUTPUT / f"instagram_{base}"
    z = shutil.make_archive(str(zip_base), "zip", str(tmp))
    shutil.rmtree(tmp, ignore_errors=True)
    return z


def main() -> int:
    if len(sys.argv) < 2:
        print("!! uso: instagram_dl.py <url>", file=sys.stderr)
        return 1
    url = sys.argv[1].strip()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    code = extrair_shortcode(url)
    user = extrair_username(url)
    base = code or user or "insta"

    if not PROFILE.exists():
        print(f"!! perfil não encontrado: {PROFILE}", file=sys.stderr)
        return 1

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(PROFILE), headless=HEADLESS,
            viewport={"width": 1280, "height": 900}, locale="pt-BR",
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            cookies = ctx.cookies()
            cookies_txt = OUTPUT / "_ig_cookies.txt"
            escrever_cookies(cookies, cookies_txt)

            resultado = None
            # POST/REEL único: tenta vídeo (yt-dlp com cookies do perfil), senão carrossel
            if code:
                resultado = baixar_video(url, cookies_txt, base)
                if not resultado:
                    page = ctx.pages[0] if ctx.pages else ctx.new_page()
                    resultado = baixar_carrossel(page, sessao_http(cookies), url, base)
            else:
                # perfil (@user): só o post é suportado por enquanto pra download único
                print("!! cole o link de um POST/REEL específico (…/p/… ou …/reel/…).", file=sys.stderr)

            try:
                cookies_txt.unlink()  # não deixar cookies de sessão no disco
            except OSError:
                pass

            if resultado:
                print(f"RESULT={resultado}")
                return 0
            print("!! nada baixado (link inválido, privado, ou não logado).", file=sys.stderr)
            return 1
        finally:
            ctx.close()


if __name__ == "__main__":
    sys.exit(main())
