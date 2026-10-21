"""End-to-end check in a real browser (optional: pip install playwright && playwright install chromium).

    python -m http.server 8765        # in the prototype_2 folder, in another terminal
    python tools/e2e_test.py          # BASE URL can be passed as the first argument

Walks every role (buyer, seller, admin) and every payment path: GCash happy path with payout, Maya rejected then corrected,
duplicate reference, wrong amount, meet-up, cancel, listing moderation, role access, hover slideshow, carousel, theme,
file:// mode and phone width. Exits non-zero on the first failure or on any console error.
"""
import os, sys, tempfile, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/").rstrip("/") + "/"
ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO = {"buyer": ("buyer@manilafinds.test", "buyer123"), "seller": ("seller@manilafinds.test", "seller123"),
        "seller2": ("seller2@manilafinds.test", "seller123"), "admin": ("admin@manilafinds.test", "admin123")}
errors, passed = [], []


def ok(msg):
    passed.append(msg)
    print("PASS", msg)


def login(pg, who):
    pg.goto(BASE + "pages/login.html")
    pg.fill("#au-email", DEMO[who][0])
    pg.fill("#au-pass", DEMO[who][1])
    pg.click("button[type=submit]")
    pg.wait_for_load_state()
    expect(pg.locator("[data-menu-toggle]")).to_be_visible()


def logout(pg):
    pg.click("[data-menu-toggle]")
    pg.click("[data-logout]")
    pg.wait_for_load_state()
    expect(pg.get_by_role("link", name="Log In")).to_be_visible()


def add_to_cart(pg, listing_id):
    pg.goto(BASE + f"pages/listing.html?id={listing_id}")
    pg.click("[data-act=add]")
    expect(pg.get_by_text("Item added to your cart")).to_be_visible()


def checkout(pg, delivery="standard", method="gcash"):
    pg.goto(BASE + "pages/checkout.html")
    if delivery == "meetup":
        pg.check("input[name=delivery][value=meetup]")
    pg.fill("#co-phone", "0917 123 4567")
    if delivery == "standard":
        pg.fill("#co-address", "12 Rizal Ave, Sampaloc, Manila")
    pg.click("[data-act=to-payment]")
    if delivery == "standard":
        pg.check(f"input[name=payment][value={method}]")
    pg.click("[data-act=to][data-step='3']")
    pg.click("[data-act=place]")
    expect(pg.locator(".confirmation")).to_be_visible()
    return pg.locator(".confirmation .ordernum").first.inner_text()


def submit_proof(pg, order_id_href, sender, ref, amount, method=None):
    pg.goto(BASE + order_id_href)
    pg.fill("#pp-sender", sender)
    pg.fill("#pp-ref", ref)
    pg.fill("#pp-amount", str(amount))
    if method:
        pg.select_option("#pp-method", method)
    pg.click("form[data-form=proof] button[type=submit]")


def card(pg, order_number):
    return pg.locator(f"[data-order='{order_number}']").first


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(f"console {m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("dialog", lambda d: (errors.append("unexpected browser dialog: " + d.message), d.dismiss()))

    # ---------- data scope: Electronics only, 25 items from the data ----------
    pg.goto(BASE)
    expect(pg.locator("[data-stat=total]")).to_have_text("25")
    expect(pg.locator(".cat-tile")).to_have_count(1)
    assert "Fashion" not in pg.inner_text("body") and "Furniture" not in pg.inner_text("body")
    pg.goto(BASE + "pages/browse.html")
    expect(pg.locator(".lcard")).to_have_count(12)
    expect(pg.locator("[data-count]")).to_contain_text("25 results")
    ok("home and browse show only the 25 Electronics listings")

    # ---------- browse: search, sort, filters ----------
    pg.goto(BASE + "pages/browse.html?q=airpods")
    expect(pg.locator(".lcard")).to_have_count(2)
    pg.goto(BASE + "pages/browse.html?sort=price-asc")
    prices = [int(t.replace("₱", "").replace(",", "")) for t in pg.locator(".lcard .pcard__price .now").all_inner_texts()]
    assert prices == sorted(prices), prices
    pg.goto(BASE + "pages/browse.html")
    pg.check("input[name=type][value=surplus]")
    expect(pg.locator("[data-count]")).to_contain_text("3 results")
    pg.check("input[name=cond][value='Well Loved']")
    expect(pg.get_by_text("No results found")).to_be_visible()
    pg.click("[data-act=clear]")
    expect(pg.locator("[data-count]")).to_contain_text("25 results")
    pg.fill("input[name=brand]", "samsung"); pg.press("input[name=brand]", "Enter")
    expect(pg.locator("[data-count]")).to_contain_text("3 results")
    pg.goto(BASE + "pages/browse.html?min=10000&max=20000")
    assert all(10000 <= int(t.replace("₱", "").replace(",", "")) <= 20000 for t in pg.locator(".lcard .pcard__price .now").all_inner_texts())
    pg.goto(BASE + "pages/browse.html?size=6.1")
    assert pg.locator(".lcard").count() >= 1
    ok("search, sort, type, condition, brand, price and size filters work")

    # ---------- card slideshow plays only while hovered ----------
    pg.goto(BASE + "pages/browse.html")
    c = pg.locator(".lcard").first
    active = lambda: c.evaluate("e => [...e.querySelectorAll('.lc-slide')].findIndex(s => s.classList.contains('is-active'))")
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(1700)
    assert active() == 0, "slideshow must not run without hover"
    c.hover()
    pg.wait_for_timeout(250)
    assert active() == 1, "hover jumps to the second photo"
    pg.wait_for_timeout(1500)
    assert active() == 2, "then steps every ~1.2 s"
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(300)
    assert active() == 0, "leaving returns to the first photo"
    pg.wait_for_timeout(1700)
    assert active() == 0, "and it stays stopped"
    ok("card slideshow plays only on hover")

    # ---------- hero carousel ----------
    pg.goto(BASE)
    slide = lambda: pg.evaluate("[...document.querySelectorAll('.hc-slide')].findIndex(s => s.classList.contains('is-active'))")
    pg.mouse.move(5, 5)
    assert slide() == 0
    pg.wait_for_timeout(4600)
    assert slide() == 1, "advances every 4 s"
    pg.locator("[data-carousel]").hover()
    pg.wait_for_timeout(4600)
    assert slide() == 1, "paused while hovered"
    pg.click(".hc-next")
    assert slide() == 2
    ok("hero carousel auto-advances, pauses on hover, arrows work")

    # ---------- role access ----------
    pg.goto(BASE + "pages/admin.html")
    expect(pg.get_by_text("Please log in")).to_be_visible()
    pg.goto(BASE + "pages/cart.html")
    expect(pg.get_by_text("Please log in")).to_be_visible()
    login(pg, "buyer")
    pg.goto(BASE + "pages/admin.html")
    expect(pg.get_by_text("Access denied")).to_be_visible()
    expect(pg.locator(".tabs")).to_have_count(0)
    pg.goto(BASE + "pages/sell.html")
    expect(pg.get_by_text("Upgrade to Seller Account")).to_be_visible()
    pg.goto(BASE + "pages/orders.html?tab=seller-orders")
    expect(pg.get_by_role("heading", name="My Orders")).to_be_visible()   # seller tabs fall back to My Orders for a buyer
    expect(pg.locator(".acct-nav a", has_text="Incoming Orders")).to_have_count(0)
    logout(pg)
    login(pg, "seller")
    pg.goto(BASE + "pages/admin.html")
    expect(pg.get_by_text("Access denied")).to_be_visible()
    logout(pg)
    ok("buyers and sellers cannot open admin; signed-out users are sent to log in; buyer sees upgrade offer on Sell")

    # ---------- flow A: GCash happy path to payout ----------
    login(pg, "buyer")
    pg.goto(BASE + "pages/browse.html?q=airpods")
    pg.locator(".lcard .lc-link", has_text="AirPods Pro").click()
    expect(pg.locator("h1")).to_contain_text("AirPods Pro")
    pg.click("[data-act=add]")
    pg.goto(BASE + "pages/cart.html")
    expect(pg.locator(".cart-row")).to_have_count(1)
    expect(pg.locator("[data-act=inc]")).to_be_disabled()   # only 1 in stock
    pg.goto(BASE + "pages/checkout.html")
    pg.click("[data-act=to-payment]")
    expect(pg.get_by_text("Please enter a phone number")).to_be_visible()
    pg.fill("#co-phone", "0917 123 4567")
    pg.click("[data-act=to-payment]")
    expect(pg.get_by_text("Please enter your delivery address")).to_be_visible()
    pg.fill("#co-address", "12 Rizal Ave, Sampaloc, Manila")
    pg.click("[data-act=to-payment]")
    pg.check("input[name=payment][value=gcash]")
    pg.click("[data-act=to][data-step='3']")
    expect(pg.locator(".summary .total")).to_contain_text("₱6,580")      # 6,500 + 80 delivery
    pg.click("[data-act=place]")
    A = pg.locator(".confirmation .ordernum").first.inner_text()
    pay_href = pg.locator(".pay-actions a").first.get_attribute("href")
    expect(pg.locator(".confirmation")).to_contain_text("pay with GCash")
    pg.goto(BASE + "pages/" + pay_href)
    expect(pg.locator(".pay-facts")).to_contain_text("0917 000 0001")
    expect(pg.locator(".pay-amount")).to_have_text("₱6,580")
    # wrong amount, short reference, missing sender are refused
    submit_proof(pg, "pages/" + pay_href, "Bea Santos", "GC1234567890", 6500)
    expect(pg.get_by_role("alert")).to_contain_text("exactly ₱6,580")
    pg.fill("#pp-ref", "AB1"); pg.fill("#pp-amount", "6580"); pg.fill("#pp-sender", "Bea Santos")
    pg.click("form[data-form=proof] button[type=submit]")
    expect(pg.get_by_role("alert")).to_contain_text("reference number")
    pg.fill("#pp-ref", "GC-1234 567890"); pg.fill("#pp-sender", "")
    pg.click("form[data-form=proof] button[type=submit]")
    expect(pg.get_by_role("alert")).to_contain_text("name on the account")
    pg.fill("#pp-sender", "Bea Santos")
    pg.click("form[data-form=proof] button[type=submit]")
    expect(pg.locator(".proof-row")).to_contain_text("GC1234567890")
    expect(pg.locator(".pay-head .pill")).to_have_text("Payment submitted")
    ok("buyer: checkout, GCash details + exact amount, proof validation, proof submitted")
    logout(pg)

    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#payments")
    r = card(pg, A)
    for text in [A, "AirPods Pro", "Bea Santos", "GC1234567890", "₱6,580", "GCash", "matches total"]:
        expect(r).to_contain_text(text)
    expect(r.locator("[data-act=approve-proof]")).to_be_disabled()      # must tick "I checked the account" first
    r.locator("[data-check]").check()
    r.locator("[data-act=approve-proof]").click()
    expect(pg.get_by_role("status").first).to_contain_text("Payment approved")
    ok("admin: Payment Confirmation shows all fields; approve needs the check box")
    logout(pg)

    login(pg, "seller")
    pg.goto(BASE + "pages/orders.html?tab=seller-orders")
    r = card(pg, A)
    expect(r).to_contain_text("Paid. Hand over the item")
    expect(r).to_contain_text("Platform fee (5% of the item price)")
    expect(r).to_contain_text("−₱325")                                   # 5% of 6,500
    expect(r).to_contain_text("₱6,175")                                  # seller payout = 6,500 - 325
    r.locator("[data-act=handover]").click()
    expect(card(pg, A)).to_contain_text("Waiting for the buyer to confirm receipt")
    ok("seller: sees paid order, 5% fee and payout, marks handed over")
    logout(pg)

    login(pg, "buyer")
    pg.goto(BASE + "pages/orders.html?tab=orders")
    card(pg, A).locator("[data-act=received]").click()
    expect(card(pg, A).locator(".pill").first).to_have_text("Completed")
    ok("buyer: confirms receipt, order completed")
    logout(pg)

    login(pg, "seller")
    pg.goto(BASE + "pages/orders.html?tab=seller-orders")
    expect(card(pg, A)).to_contain_text("Pending release")
    logout(pg)

    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#payouts")
    r = card(pg, A)
    expect(r).to_contain_text("₱6,255")                                  # payout 6,175 + 80 delivery passed on
    r.locator("input[name=reference]").fill("x")
    r.locator("button[type=submit]").click()
    expect(pg.get_by_role("alert")).to_contain_text("reference number")
    card(pg, A).locator("input[name=reference]").fill("PAYOUT-0001")
    card(pg, A).locator("button[type=submit]").click()
    pg.click("[data-act=yf][data-k=released]")
    expect(card(pg, A)).to_contain_text("PAYOUT0001")
    pg.goto(BASE + "pages/admin.html#log")
    for text in ["Buyer confirmed receipt", "Payment approved", "payout released"]:
        expect(pg.locator(".data-table")).to_contain_text(text)
    ok("admin: releases the payout only after completion; activity log has actors and times")
    logout(pg)

    login(pg, "seller")
    pg.goto(BASE + "pages/orders.html?tab=seller-orders")
    expect(card(pg, A)).to_contain_text("Released")
    expect(card(pg, A)).to_contain_text("PAYOUT0001")
    logout(pg)
    login(pg, "buyer")
    pg.goto(BASE + "pages/orders.html?tab=notifications")
    expect(pg.locator(".notif-list")).to_contain_text("Payment approved")
    logout(pg)

    # ---------- flow B: Maya rejected, duplicate reference, corrected, approved ----------
    login(pg, "buyer")
    add_to_cart(pg, "e12")                                               # AirPods 2nd gen, 3,600
    B = checkout(pg, "standard", "maya")
    href = "pages/" + pg.locator(".pay-actions a").first.get_attribute("href")
    submit_proof(pg, href, "Bea S", "GC1234567890", 3680)                # reference already used by order A
    expect(pg.get_by_role("alert")).to_contain_text("already used")
    pg.fill("#pp-ref", "MAYA7771"); pg.fill("#pp-sender", "Bea S"); pg.fill("#pp-amount", "3680")
    pg.click("form[data-form=proof] button[type=submit]")
    expect(pg.locator(".pay-head .pill")).to_have_text("Payment submitted")
    logout(pg)
    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#payments")
    r = card(pg, B)
    r.locator("[data-act=reject-proof-ask]").click()
    pg.locator("form[data-form=reject-proof] button[type=submit]").click()
    expect(pg.get_by_role("alert")).to_contain_text("reason")
    pg.fill("form[data-form=reject-proof] textarea", "Sender name does not match the receipt")
    pg.locator("form[data-form=reject-proof] button[type=submit]").click()
    pg.click("[data-act=pf][data-k=rejected]")
    expect(card(pg, B)).to_contain_text("Sender name does not match")
    logout(pg)
    login(pg, "buyer")
    pg.goto(BASE + "pages/orders.html?tab=orders")
    expect(card(pg, B)).to_contain_text("Payment not approved: Sender name does not match")
    card(pg, B).get_by_role("link", name="Send corrected proof").click()
    expect(pg.get_by_role("alert").first).to_contain_text("Sender name does not match")
    pg.fill("#pp-sender", "Bea Santos"); pg.fill("#pp-ref", "maya 7771"); pg.fill("#pp-amount", "3680")   # a rejected reference can be reused
    pg.click("form[data-form=proof] button[type=submit]")
    expect(pg.locator(".proof-row")).to_have_count(2)
    expect(pg.locator(".pay-head .pill")).to_have_text("Payment submitted")
    logout(pg)
    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#payments")
    card(pg, B).locator("[data-check]").check()
    card(pg, B).locator("[data-act=approve-proof]").click()
    expect(pg.get_by_role("status").first).to_contain_text("approved")
    ok("rejected payment shows the reason, corrected proof is approved; duplicate reference refused")
    # admin cannot release a payout that is not due
    pg.goto(BASE + "pages/admin.html#payouts")
    pg.click("[data-act=yf][data-k=not_due]")
    expect(card(pg, B)).to_contain_text("Not due yet")
    expect(card(pg, B).locator("form[data-form=release]")).to_have_count(0)
    logout(pg)

    # ---------- flow C: meet-up (no platform payment) ----------
    login(pg, "buyer")
    add_to_cart(pg, "e16")                                               # Mi Smart Band, 900, stock 2
    C = checkout(pg, "meetup")
    expect(pg.locator(".confirmation")).to_contain_text("arranged directly")
    expect(pg.locator(".pay-actions")).to_have_count(0)
    pg.goto(BASE + "pages/orders.html?tab=orders")
    expect(card(pg, C)).to_contain_text("Awaiting seller")
    expect(card(pg, C)).not_to_contain_text("ManilaFinds, which pays the seller")
    expect(card(pg, C).locator("a[href*='pay.html']")).to_have_count(0)
    logout(pg)
    login(pg, "seller")
    pg.goto(BASE + "pages/orders.html?tab=seller-orders")
    expect(card(pg, C)).not_to_contain_text("Platform fee")
    card(pg, C).locator("[data-act=confirm-meetup]").click()
    card(pg, C).locator("[data-act=handover]").click()
    expect(card(pg, C).locator(".pill").first).to_have_text("Completed")
    logout(pg)
    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#payouts")
    pg.click("[data-act=yf][data-k=released]")
    assert C not in pg.inner_text("#panel"), "meet-up orders never appear in payouts"
    logout(pg)
    ok("meet-up: no payment details, fee, proof or payout; seller confirms and completes")

    # ---------- flow D: cancel paths ----------
    login(pg, "buyer")
    add_to_cart(pg, "e17"); add_to_cart(pg, "e13")                       # two sellers -> two orders
    pg.goto(BASE + "pages/checkout.html")
    pg.fill("#co-phone", "0917 123 4567"); pg.fill("#co-address", "1 Taft Ave")
    pg.click("[data-act=to-payment]"); pg.click("[data-act=to][data-step='3']")
    expect(pg.locator(".co-note")).to_contain_text("2 sellers")
    pg.click("[data-act=place]")
    assert pg.locator(".confirmation .order-list > div").count() == 2
    pg.goto(BASE + "pages/orders.html?tab=orders")
    first = pg.locator(".ord-card").first
    num = first.locator(".order-number").inner_text()
    first.locator("[data-act=cancel-ask]").click()
    pg.fill("textarea[name=reason]", "Changed my mind")
    pg.click("form[data-form=cancel] button[type=submit]")
    expect(card(pg, num)).to_contain_text("Cancelled by you")
    pg.goto(BASE + "pages/listing.html?id=e17")
    ok("buyer: multi-seller cart makes two orders; cancelling before payment works")
    logout(pg)

    # ---------- flow E: seller listing + admin moderation ----------
    tmp = pathlib.Path(tempfile.mkdtemp())
    from PIL import Image
    for i, col in enumerate([(200, 40, 40), (40, 40, 200)]):
        Image.new("RGB", (600, 400), col).save(tmp / f"ph{i}.png")
    login(pg, "seller")
    pg.goto(BASE + "pages/sell.html")
    pg.click("button[type=submit]")
    expect(pg.get_by_role("alert")).to_contain_text("Title is required")
    pg.fill("#sl-title", "Anker 20,000mAh Power Bank"); pg.fill("#sl-price", "1800")
    pg.set_input_files("[data-photos]", [str(tmp / "ph0.png"), str(tmp / "ph1.png")])
    expect(pg.locator(".photo-grid .ph")).to_have_count(2)
    pg.click("button[type=submit]")
    expect(pg.get_by_role("alert")).to_contain_text("describe the item")
    pg.fill("#sl-desc", "Works fine, 2 USB-C ports.")
    pg.click("button[type=submit]")
    expect(pg.get_by_role("alert")).to_contain_text("Brand, size / dimensions and material / color are required")
    pg.fill("#sl-brand", "Anker"); pg.fill("#sl-mat", "Black"); pg.fill("#sl-size", "150 x 70 x 40 mm")
    pg.set_input_files("[data-photos]", [str(tmp / f"ph{i % 2}.png") for i in range(5)])   # 2 already attached: only 3 more fit
    expect(pg.locator(".photo-grid .ph")).to_have_count(5)
    expect(pg.get_by_role("alert")).to_contain_text("at most 5 photos")
    pg.click("button[type=submit]")
    expect(pg.get_by_role("heading", name="Submitted for review")).to_be_visible()
    pg.goto(BASE + "pages/browse.html?q=anker")
    expect(pg.get_by_text("No results found")).to_be_visible()           # not live yet
    logout(pg)
    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#listings")
    r = pg.locator("[data-listing]", has_text="Anker 20,000mAh")
    r.locator("[data-act=reject-ask]").click()
    pg.locator("form[data-form=reject-listing] button[type=submit]").click()
    expect(pg.get_by_role("alert")).to_contain_text("reason")
    pg.fill("form[data-form=reject-listing] textarea", "Please add a photo of the ports")
    pg.locator("form[data-form=reject-listing] button[type=submit]").click()
    pg.click("[data-act=lf][data-k=rejected]")
    r = pg.locator("[data-listing]", has_text="Anker 20,000mAh")
    expect(r).to_contain_text("Please add a photo of the ports")
    r.locator("[data-act=approve-listing]").click()
    expect(pg.get_by_role("status").first).to_contain_text("Published")
    pg.goto(BASE + "pages/browse.html?q=anker")
    expect(pg.locator(".lcard")).to_have_count(1)
    # admin lists directly: "Published"
    pg.goto(BASE + "pages/sell.html")
    pg.fill("#sl-title", "Admin test charger"); pg.fill("#sl-price", "500"); pg.fill("#sl-desc", "Demo.")
    pg.fill("#sl-brand", "Unbranded"); pg.fill("#sl-mat", "White"); pg.fill("#sl-size", "10 cm")
    pg.click("button[type=submit]")
    expect(pg.get_by_role("heading", name="Published")).to_be_visible()
    logout(pg)
    login(pg, "seller")
    pg.goto(BASE + "pages/orders.html?tab=listings")
    expect(pg.locator(".lm-card", has_text="Anker 20,000mAh")).to_contain_text("Published")
    logout(pg)
    ok("seller listing (5 photos max, required fields) -> admin rejects with reason -> approves; admin listing says Published")

    # ---------- flow F: admin payment details switch a method off ----------
    login(pg, "admin")
    pg.goto(BASE + "pages/admin.html#settings")
    f = pg.locator("form[data-m=maya]")
    f.locator("input[name=active]").uncheck()
    f.locator("button[type=submit]").click()
    logout(pg)
    login(pg, "buyer")
    add_to_cart(pg, "e19")
    pg.goto(BASE + "pages/checkout.html")
    pg.fill("#co-phone", "0917 123 4567"); pg.fill("#co-address", "1 Taft Ave")
    pg.click("[data-act=to-payment]")
    expect(pg.locator(".opt-card.is-off")).to_contain_text("Maya")
    expect(pg.locator("input[name=payment][value=maya]")).to_be_disabled()
    logout(pg)
    ok("admin can switch Maya off; checkout shows it as not available")

    # ---------- theme, signup, reset ----------
    pg.goto(BASE)
    before = pg.evaluate("document.documentElement.getAttribute('data-theme')")
    pg.click("[data-theme-toggle]")
    after = pg.evaluate("document.documentElement.getAttribute('data-theme')")
    assert after in ("light", "dark") and after != before
    pg.reload()
    assert pg.evaluate("document.documentElement.getAttribute('data-theme')") == after
    pg.goto(BASE + "pages/login.html?mode=signup")
    pg.fill("#au-first", "Zed"); pg.fill("#au-last", "Tester"); pg.fill("#au-email", "zed@example.test"); pg.fill("#au-pass", "secret1")
    pg.click("[data-act=role][data-role=seller]")
    pg.click("button[type=submit]")
    expect(pg.locator("[data-menu-toggle]")).to_contain_text("Zed")
    pg.goto(BASE + "pages/admin.html")
    expect(pg.get_by_text("Access denied")).to_be_visible()
    ok("theme persists, sign-up creates a seller who cannot open admin")

    # ---------- keyboard: skip link, menu with Escape ----------
    pg.goto(BASE)
    pg.keyboard.press("Tab")
    assert pg.evaluate("document.activeElement.className") == "skip-link"
    pg.click("[data-menu-toggle]")
    pg.keyboard.press("Escape")
    assert pg.locator("[data-menu]").is_hidden()
    ok("keyboard: skip link first, account menu closes with Escape")

    # ---------- alt text ----------
    for u in ["", "pages/browse.html", "pages/listing.html?id=e03"]:
        pg.goto(BASE + u)
        assert pg.locator("img:not([alt])").count() == 0, f"images without alt on {u}"
    ok("every image has an alt attribute")

    # ---------- phone width: no horizontal scroll ----------
    m = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mp = m.new_page()
    mp.on("console", lambda msg: errors.append(f"mobile console {msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
    mp.goto(BASE + "pages/login.html")
    mp.fill("#au-email", DEMO["admin"][0]); mp.fill("#au-pass", DEMO["admin"][1]); mp.click("button[type=submit]")
    wide = []
    for u in ["", "pages/browse.html", "pages/listing.html?id=e01", "pages/cart.html", "pages/checkout.html", "pages/orders.html?tab=orders",
              "pages/orders.html?tab=seller-orders", "pages/admin.html#overview", "pages/admin.html#listings", "pages/admin.html#payments",
              "pages/admin.html#payouts", "pages/admin.html#settings", "pages/admin.html#log", "pages/sell.html", "pages/login.html"]:
        mp.goto(BASE + u)
        mp.wait_for_timeout(250)
        over = mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if over > 1:
            wide.append((u, over))
    assert not wide, f"horizontal overflow at 390px: {wide}"
    m.close()
    ok("no horizontal scroll at phone width on every page")

    # ---------- file:// mode (no server): seed.js fallback ----------
    f = browser.new_context(viewport={"width": 1280, "height": 900})
    fp = f.new_page()
    fp.on("pageerror", lambda e: errors.append(f"file:// pageerror: {e}"))
    fp.goto((ROOT / "index.html").as_uri())
    expect(fp.locator("[data-stat=total]")).to_have_text("25")
    fp.goto((ROOT / "pages" / "browse.html").as_uri())
    expect(fp.locator(".lcard")).to_have_count(12)
    f.close()
    ok("opens straight from disk (file://) with the seed.js fallback")

    browser.close()

real = [e for e in errors if "fonts.g" not in e and "ERR_INTERNET_DISCONNECTED" not in e and "ERR_NAME_NOT_RESOLVED" not in e]
print(f"\n{len(passed)} checks passed")
if real:
    print("CONSOLE ERRORS:\n  " + "\n  ".join(real))
    sys.exit(1)
print("no console errors")
