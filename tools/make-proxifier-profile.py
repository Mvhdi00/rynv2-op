#!/usr/bin/env python3
"""Build a Proxifier for Windows profile (.ppx) from a proxy list.

The input may be a local file or an HTTP(S) URL (e.g. a Webshare
"Download list" link). Each non-empty line is parsed with automatic
format detection; nothing is dropped unless the line cannot possibly be
a proxy.

Supported line formats
    host:port
    host:port:username:password
    username:password@host:port
    scheme://host:port
    scheme://username:password@host:port
    host,port[,username,password]           (comma / tab / space separated)

`scheme` (http, https, socks5, socks4, socks) overrides the default type
for that single line, so a mixed list keeps each entry's real protocol.

Usage
    python3 tools/make-proxifier-profile.py INPUT OUTPUT.ppx [--type HTTPS]
"""

from __future__ import annotations

import argparse
import base64
import ipaddress
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

# Proxifier's own type names. "HTTPS" is Proxifier's label for an HTTP
# proxy that supports CONNECT (i.e. tunnels arbitrary TCP) - that is the
# type Webshare's HTTP endpoints need. "HTTP" is the HTTP-only variant.
VALID_TYPES = ("HTTPS", "HTTP", "SOCKS5", "SOCKS4")

SCHEME_TO_TYPE = {
    "http": "HTTPS",
    "https": "HTTPS",
    "socks": "SOCKS5",
    "socks5": "SOCKS5",
    "socks5h": "SOCKS5",
    "socks4": "SOCKS4",
    "socks4a": "SOCKS4",
}

HOSTNAME_RE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$")

FIRST_PROXY_ID = 100


class ParseError(Exception):
    pass


def read_source(source: str) -> str:
    if source.startswith(("http://", "https://")):
        req = urllib.request.Request(
            source, headers={"User-Agent": "proxifier-profile-builder/1.0"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read().decode("utf-8", errors="replace")
    with open(source, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def valid_host(host: str) -> bool:
    if not host:
        return False
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    return bool(HOSTNAME_RE.match(host)) and len(host) <= 253


def valid_port(port: str) -> bool:
    return port.isdigit() and 0 < int(port) < 65536


def parse_line(line: str, default_type: str) -> dict:
    """Return {type, host, port, user, password} or raise ParseError."""
    raw = line.strip()
    if not raw or raw.startswith(("#", ";", "//")):
        raise ParseError("empty or comment")

    ptype = default_type
    scheme_match = re.match(r"^([A-Za-z0-9]+)://(.*)$", raw)
    if scheme_match:
        scheme = scheme_match.group(1).lower()
        if scheme not in SCHEME_TO_TYPE:
            raise ParseError(f"unknown scheme '{scheme}'")
        ptype = SCHEME_TO_TYPE[scheme]
        raw = scheme_match.group(2)

    user = password = ""

    # user:pass@host:port
    if "@" in raw:
        creds, _, endpoint = raw.rpartition("@")
        user, _, password = creds.partition(":")
        raw = endpoint

    # Normalise separators: commas / tabs / spaces / semicolons -> ":"
    fields = [f for f in re.split(r"[\s,;|]+", raw) if f]
    if len(fields) > 1:
        raw = ":".join(fields)

    parts = raw.split(":")
    if len(parts) == 2:
        host, port = parts
    elif len(parts) == 4:
        host, port, u, p = parts
        # Explicit per-line credentials win over an "@" prefix.
        user, password = u, p
    elif len(parts) == 3 and valid_port(parts[1]):
        # host:port:something -> treat trailing field as username
        host, port, user = parts
    else:
        raise ParseError(f"unrecognised format ({len(parts)} fields)")

    host = host.strip()
    port = port.strip()
    if not valid_host(host):
        raise ParseError(f"invalid host '{host}'")
    if not valid_port(port):
        raise ParseError(f"invalid port '{port}'")

    return {
        "type": ptype,
        "host": host,
        "port": port,
        "user": user,
        "password": password,
    }


def encode_password(password: str) -> str:
    """Proxifier stores proxy passwords base64-encoded (Encryption mode="basic")."""
    return base64.b64encode(password.encode("utf-8")).decode("ascii")


def build_profile(proxies: list[dict], profile_name: str) -> str:
    out: list[str] = []
    add = out.append

    add('<?xml version="1.0" encoding="UTF-8"?>')
    add(
        '<ProxifierProfile version="101" platform="Windows" '
        'product_id="0" product_minver="400">'
    )
    add("  <Options>")
    add("    <Resolve>")
    add('      <AutoModeDetection enabled="false"/>')
    add('      <ViaProxy enabled="false">')
    add('        <TryLocalDnsFirst enabled="false"/>')
    add("      </ViaProxy>")
    add("      <ExclusionList>%ComputerName%; localhost; *.local</ExclusionList>")
    add("    </Resolve>")
    add('    <Encryption mode="basic"/>')
    add('    <ConnectionLoopDetection enabled="true"/>')
    add('    <ProcessOtherUsers enabled="false"/>')
    add('    <ProcessServices enabled="false"/>')
    add('    <HandleDirectConnections enabled="false"/>')
    add('    <HttpProxiesSupport enabled="false"/>')
    add("  </Options>")

    add("  <ProxyList>")
    for index, proxy in enumerate(proxies):
        pid = FIRST_PROXY_ID + index
        add(f'    <Proxy id="{pid}" type="{proxy["type"]}">')
        add(f"      <Address>{escape(proxy['host'])}</Address>")
        add(f"      <Port>{proxy['port']}</Port>")
        add("      <Options>48</Options>")
        if proxy["user"] or proxy["password"]:
            add('      <Authentication enabled="true">')
            add(f"        <Username>{escape(proxy['user'])}</Username>")
            add(f"        <Password>{encode_password(proxy['password'])}</Password>")
            add("      </Authentication>")
        else:
            add('      <Authentication enabled="false"/>')
        add("    </Proxy>")
    add("  </ProxyList>")

    add("  <ChainList/>")

    # No proxy is wired into a rule: every entry stays a selectable item in
    # Proxifier's proxy list, and traffic keeps flowing Direct until the
    # user picks one.
    add("  <RuleList>")
    add('    <Rule enabled="true">')
    add("      <Name>Localhost</Name>")
    add("      <Targets>localhost; 127.0.0.1; %ComputerName%</Targets>")
    add('      <Action type="Direct"/>')
    add("    </Rule>")
    add('    <Rule enabled="true">')
    add("      <Name>Default</Name>")
    add('      <Action type="Direct"/>')
    add("    </Rule>")
    add("  </RuleList>")

    add("</ProxifierProfile>")
    add("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", help="proxy list file path or http(s) URL")
    ap.add_argument("output", help="path of the .ppx profile to write")
    ap.add_argument(
        "--type",
        default="HTTPS",
        choices=VALID_TYPES,
        help="proxy type for lines that do not carry an explicit scheme "
        "(default: HTTPS = HTTP proxy with CONNECT support)",
    )
    ap.add_argument(
        "--name",
        default="Webshare",
        help="profile name used in the report output",
    )
    args = ap.parse_args()

    text = read_source(args.input)
    lines = text.splitlines()

    proxies: list[dict] = []
    skipped: list[tuple[int, str, str]] = []
    for lineno, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            proxies.append(parse_line(line, args.type))
        except ParseError as exc:
            skipped.append((lineno, line.strip(), str(exc)))

    if not proxies:
        print("No proxies parsed - nothing written.", file=sys.stderr)
        for lineno, line, reason in skipped:
            print(f"  line {lineno}: {line!r} -> {reason}", file=sys.stderr)
        return 1

    xml_text = build_profile(proxies, args.name)

    # Validate before writing anything to disk.
    root = ET.fromstring(xml_text)
    listed = root.find("ProxyList")
    assert listed is not None
    ids = [p.get("id") for p in listed.findall("Proxy")]
    if len(ids) != len(set(ids)):
        print("Duplicate proxy IDs generated - aborting.", file=sys.stderr)
        return 1
    if len(ids) != len(proxies):
        print("Proxy count mismatch after XML build - aborting.", file=sys.stderr)
        return 1

    with open(args.output, "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(xml_text)

    types: dict[str, int] = {}
    for proxy in proxies:
        types[proxy["type"]] = types.get(proxy["type"], 0) + 1
    with_auth = sum(1 for p in proxies if p["user"] or p["password"])

    print(f"Source lines      : {len(lines)}")
    print(f"Proxies parsed    : {len(proxies)}")
    print(f"Proxies in profile: {len(ids)}")
    print(f"With credentials  : {with_auth}")
    print(f"Types             : {', '.join(f'{k}={v}' for k, v in sorted(types.items()))}")
    print(f"ID range          : {ids[0]}..{ids[-1]}")
    if skipped:
        print(f"Skipped lines     : {len(skipped)}")
        for lineno, line, reason in skipped:
            print(f"  line {lineno}: {line!r} -> {reason}")
    print(f"Written           : {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
