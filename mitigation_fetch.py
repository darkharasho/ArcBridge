import re
import time
import csv
import requests
from urllib.parse import quote

from bs4 import BeautifulSoup

GW2_API = "https://api.guildwars2.com/v2"
GW2SKILLS = "https://en.gw2skills.net/wiki"

SKILLS = [
    "Frost Aura",
    "Frozen Ground",
    "Dual Orbits: Air and Earth",
    "Dual Orbits: Fire and Earth",
    "Dual Orbits: Water and Earth",
    "Grinding Stones",
    "Rocky Loop",
    "Explosive Thrust",
    "Steel Divide",
    "Swift Cut",
    "Restorative Glow",
    "Infusing Terror",
    "Perilous Gift",
    "Resilient Weapon",
    "Signet of Judgment",
    "Forced Engagement",
    "Vengeful Hammers",
    "Endure Pain",
    "Spectrum Shield",
    "Barrier Signet",
    "\"Guard!\"",
    "Dolyak Stance",
    "\"Flash-Freeze!\"",
    "\"Rise!\"",
    "Daring Advance",
    "Rite of the Great Dwarf",
    "Rampage",
    "\"Rebound!\"",
    "Weave Self",
    "Ancient Echo",
    "Facet of Nature",
    "Full Counter",
    "Drink Ambrosia",
    "Throw Enchanted Ice",
    "Enter Shadow Shroud",
    "Death Shroud",
    "Reaper's Shroud",
    "Ritualist's Shroud",
    "Lesser \"Guard!\"",
]

# Optional: aliases if the official API uses different names
ALIASES = {
    # "Drink Ambrosia": "Some Official API Name",
    # "Throw Enchanted Ice": "Some Official API Name",
}

HEADERS = {"User-Agent": "gw2-damage-reduction-scraper/1.1 (personal use)"}

# -------------------------
# Formatting helpers
# -------------------------
def format_elapsed(seconds: float) -> str:
    if seconds < 0:
        return "0s"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"

def format_eta(start_time: float, done: int, total: int) -> str:
    if done <= 0 or total <= 0:
        return "ETA ?"
    elapsed = time.time() - start_time
    rate = done / max(elapsed, 0.001)
    remaining = max(total - done, 0)
    eta = remaining / rate if rate > 0 else 0
    return f"ETA {format_elapsed(eta)}"

# -------------------------
# API helpers
# -------------------------
def api_get_json(url, params=None, retries=3):
    for i in range(retries):
        r = requests.get(url, params=params, headers=HEADERS, timeout=60)
        if r.status_code == 200:
            return r.json()
        time.sleep(0.5 * (i + 1))
    raise RuntimeError(f"API failed: {r.status_code} {r.text[:200]}")

def norm_name(s: str) -> str:
    s = s.lower()
    s = s.replace("’", "'")
    s = re.sub(r'["“”]', "", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s

def build_name_to_id_map():
    name_to_id = {}
    start_time = time.time()

    objs = api_get_json(f"{GW2_API}/skills", params={"ids": "all", "lang": "en"})
    total = len(objs) if isinstance(objs, list) else 0

    for i, obj in enumerate(objs, 1):
        nm = obj.get("name")
        sid = obj.get("id")
        if nm and sid:
            name_to_id[nm] = sid
            name_to_id[nm.lower()] = sid
            name_to_id[norm_name(nm)] = sid

        if i % 500 == 0 or i == total:
            print(f"[api] Indexed {i}/{total} skills ({format_elapsed(time.time() - start_time)}, {format_eta(start_time, i, total)})")
            time.sleep(0.02)

    return name_to_id

def resolve_skill_id(name_to_id: dict, nm: str):
    nm2 = ALIASES.get(nm, nm)
    return (
        name_to_id.get(nm2)
        or name_to_id.get(nm2.lower())
        or name_to_id.get(norm_name(nm2))
    )

# -------------------------
# gw2skills scraping helpers
# -------------------------
def gw2skills_url_for_skill(name: str) -> str:
    slug = name.replace(" ", "_")
    return f"{GW2SKILLS}/{quote(slug, safe=':_()!')}"

def fetch_gw2skills_html(name: str) -> str:
    url = gw2skills_url_for_skill(name)
    r = requests.get(url, headers=HEADERS, timeout=60)
    if r.status_code != 200:
        return ""
    return r.text

def soup_main_text(soup: BeautifulSoup) -> str:
    # Try common content containers; fall back to body
    for sel in ["#mw-content-text", ".mw-parser-output", "#content", "main", "article"]:
        node = soup.select_one(sel)
        if node:
            return node.get_text("\n", strip=True)
    return (soup.body or soup).get_text("\n", strip=True)

def split_mode_blocks(text: str):
    """
    Best-effort segmentation:
    Return dict with keys: "wvw", "pvp", "pve", "all"
    """
    lower = text.lower()
    blocks = {"all": text, "pve": "", "pvp": "", "wvw": ""}

    # Find headings by literal tokens; gw2skills pages frequently include these labels.
    # We'll slice between occurrences.
    # If not present, block remains empty and caller falls back.
    def find_idx(token):
        i = lower.find(token)
        return i if i != -1 else None

    idx_pve = find_idx("\npve\n") or find_idx("#### pve") or find_idx("pve")
    idx_pvp = find_idx("\npvp\n") or find_idx("#### pvp") or find_idx("pvp")
    idx_wvw = find_idx("\nwvw\n") or find_idx("#### wvw") or find_idx("wvw")

    # Collect found indices (token, idx)
    found = [(k, v) for k, v in [("pve", idx_pve), ("pvp", idx_pvp), ("wvw", idx_wvw)] if v is not None]
    found.sort(key=lambda x: x[1])

    # Slice between headings
    for j, (mode, start) in enumerate(found):
        end = found[j + 1][1] if j + 1 < len(found) else len(text)
        blocks[mode] = text[start:end]

    return blocks

# -------------------------
# Parsing logic
# -------------------------
def _pick_best_pct_from_matches(matches):
    # We want a stable answer: prefer the one closest to "Incoming Damage" wording,
    # but since matches are already filtered by regex, we just pick max abs within sane range.
    cleaned = []
    for v in matches:
        try:
            v = int(v)
        except Exception:
            continue
        if -100 <= v <= 100:
            cleaned.append(v)
    if not cleaned:
        return None
    best = max(cleaned, key=lambda x: abs(x))
    return abs(best)

def parse_reduction_facts(text_all: str):
    """
    Critical fix:
      - Prefer parsing % reducers FROM WvW BLOCK if present.
      - Only fall back to full text if WvW block doesn't contain anything.
      - Exclude boon lines for Protection/Resolution from being misinterpreted as the skill passive.
    """
    blocks = split_mode_blocks(text_all)
    wvw_text = blocks.get("wvw", "").strip()

    # We'll parse reductions primarily from WvW text if available.
    primary = wvw_text if wvw_text else text_all

    # Strip out known boon effect lines that cause false captures (esp. Signet of Judgment page)
    # This does NOT affect skills that are literally "Protection" or "Resolution" (not in your list).
    def remove_boon_lines(t: str) -> str:
        lines = []
        for ln in t.splitlines():
            l = ln.lower()
            if l.startswith("protection") or l.startswith("resolution"):
                # keep the line if it is the skill name itself (rare) — otherwise drop
                continue
            lines.append(ln)
        return "\n".join(lines)

    primary = remove_boon_lines(primary)

    # Percent reducers (strict)
    dmg_matches = [int(x) for x in re.findall(r"([+-]?\d+)\s*%\s+Incoming Damage\b", primary, flags=re.IGNORECASE)]
    cond_matches = [int(x) for x in re.findall(r"([+-]?\d+)\s*%\s+Incoming Condition Damage\b", primary, flags=re.IGNORECASE)]

    # Fallback patterns (still within primary text only)
    dmg_matches += [int(x) for x in re.findall(r"([+-]?\d+)\s*%\s+Incoming Strike Damage\b", primary, flags=re.IGNORECASE)]
    dmg_matches += [int(x) for x in re.findall(r"Incoming damage (?:is )?(?:reduced|decreased) by\s*([+-]?\d+)\s*%", primary, flags=re.IGNORECASE)]
    dmg_matches += [int(x) for x in re.findall(r"Damage taken (?:is )?(?:reduced|decreased) by\s*([+-]?\d+)\s*%", primary, flags=re.IGNORECASE)]
    cond_matches += [int(x) for x in re.findall(r"Incoming condition damage (?:is )?(?:reduced|decreased) by\s*([+-]?\d+)\s*%", primary, flags=re.IGNORECASE)]

    dmg = _pick_best_pct_from_matches(dmg_matches)
    cond = _pick_best_pct_from_matches(cond_matches)

    # If WvW block existed but produced nothing, fall back to full text (still remove boon lines)
    if wvw_text and dmg is None and cond is None:
        fallback = remove_boon_lines(text_all)
        dmg2 = [int(x) for x in re.findall(r"([+-]?\d+)\s*%\s+Incoming Damage\b", fallback, flags=re.IGNORECASE)]
        cond2 = [int(x) for x in re.findall(r"([+-]?\d+)\s*%\s+Incoming Condition Damage\b", fallback, flags=re.IGNORECASE)]
        dmg = _pick_best_pct_from_matches(dmg2)
        cond = _pick_best_pct_from_matches(cond2)

    # Invulnerability detection: use full text (invuln phrasing may not be repeated in WvW section)
    invuln_strike = bool(re.search(
        r"take no damage from (attacks|strikes)|invulnerable to (attacks|strikes)",
        text_all,
        flags=re.IGNORECASE
    ))
    invuln_any = bool(re.search(r"\binvulnerab|\btake no damage\b", text_all, flags=re.IGNORECASE))

    # Classification
    if invuln_strike:
        scope = "strike_only"
        mechanic = "invuln"
    elif invuln_any:
        scope = "all"
        mechanic = "invuln"
    elif dmg is not None and cond is not None:
        scope = "all"
        mechanic = "pct_reduction"
    elif dmg is not None:
        scope = "all"
        mechanic = "pct_reduction"
    elif cond is not None:
        scope = "cond_only"
        mechanic = "pct_reduction"
    else:
        scope = "unknown"
        mechanic = "other"

    # Normalize invuln for downstream math
    if mechanic == "invuln":
        if scope == "strike_only":
            dmg = 100
        else:
            dmg = 100
            cond = 100

    # Duration/cooldown best-effort: prefer WvW block if present
    timing = wvw_text if wvw_text else text_all
    cooldown = None
    duration = None

    mcd = re.search(r"\bRecharge\b\s*:?\s*(\d+)\b", timing, flags=re.IGNORECASE)
    if mcd:
        cooldown = int(mcd.group(1))

    mdur = re.search(r"\bDuration\b\s*:?\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b", timing, flags=re.IGNORECASE)
    if mdur:
        duration = float(mdur.group(1))

    return {
        "incoming_damage_reduction_pct": dmg,
        "incoming_condition_damage_reduction_pct": cond,
        "scope": scope,
        "mechanic_type": mechanic,
        "invuln_detected": invuln_any,
        "invuln_strike_only": invuln_strike,
        "wvw_duration_s_guess": duration,
        "wvw_cooldown_s_guess": cooldown,
    }

# -------------------------
# Main
# -------------------------
def main():
    overall_start = time.time()
    print("Building name->id map from official API (ids=all)...")
    name_to_id = build_name_to_id_map()
    print(f"[api] Done in {format_elapsed(time.time() - overall_start)}")

    rows = []
    unresolved = []

    skill_start = time.time()
    total_skills = len(SKILLS)

    for i, nm in enumerate(SKILLS, 1):
        sid = resolve_skill_id(name_to_id, nm)
        if sid is None:
            unresolved.append(nm)

        html = fetch_gw2skills_html(nm)
        if html:
            soup = BeautifulSoup(html, "html.parser")
            text_all = soup_main_text(soup)
            facts = parse_reduction_facts(text_all)
        else:
            facts = {
                "incoming_damage_reduction_pct": None,
                "incoming_condition_damage_reduction_pct": None,
                "scope": "unknown",
                "mechanic_type": "other",
                "invuln_detected": None,
                "invuln_strike_only": None,
                "wvw_duration_s_guess": None,
                "wvw_cooldown_s_guess": None,
            }

        rows.append({
            "name": nm,
            "api_skill_id": sid,
            "wvw_incoming_damage_reduction_pct": facts["incoming_damage_reduction_pct"],
            "wvw_incoming_condition_damage_reduction_pct": facts["incoming_condition_damage_reduction_pct"],
            "scope": facts["scope"],
            "mechanic_type": facts["mechanic_type"],
            "invuln_detected": facts["invuln_detected"],
            "invuln_strike_only": facts["invuln_strike_only"],
            "wvw_duration_s_guess": facts["wvw_duration_s_guess"],
            "wvw_cooldown_s_guess": facts["wvw_cooldown_s_guess"],
            "gw2skills_url": gw2skills_url_for_skill(nm),
        })

        print(f"[skills] {i}/{total_skills} {nm} ({format_elapsed(time.time() - skill_start)}, {format_eta(skill_start, i, total_skills)})")
        time.sleep(0.1)

    out = "damage_reduction_wvw.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"\nWrote {out} with {len(rows)} rows.")

    if unresolved:
        print("\n[warn] Could not resolve API ids for:")
        for nm in unresolved:
            print(f"  - {nm}")
        print("\nTip: fill ALIASES for those names, or they may not exist as /v2/skills entries.")

    print("\nNotes:")
    print("- Parses % reducers from the WvW section when present (fixes Rocky Loop 15->10 and Dual Orbits weirdness).")
    print("- Filters out Protection/Resolution lines so Signet of Judgment stays at its passive 10/10.")
    print("- cooldown/duration still best-effort; verify critical skills manually.")

if __name__ == "__main__":
    main()
