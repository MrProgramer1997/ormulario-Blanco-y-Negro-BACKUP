"""Visual / UI regression tests for the standalone preview, without any external calls.
Requires Python + Playwright and a Chromium executable; not needed to run the app.
Run from project root: python tests/ui-visual-v2.py
Browser content is loaded in memory. This does not validate HTTP deployment or ePayco.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get('BN_SHOTS', str(ROOT / 'tests' / 'screenshots')))
OUTPUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
requests = []

def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)

def new_page(browser, admin=False, width=1440, height=1050):
    page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.url) if r.url.startswith(('https:', 'http:')) else None)
    filename = 'ADMIN-DEMO.html' if admin else 'VISTA-PREVIA.html'
    page.set_content((ROOT / filename).read_text(), wait_until='load')
    page.wait_for_selector('#demo-button' if admin else '.map-marker')
    return page

def dark(page):
    if page.locator('html').get_attribute('data-theme') != 'dark':
        page.locator('.theme-toggle').click()

def light(page):
    if page.locator('html').get_attribute('data-theme') != 'light':
        page.locator('.theme-toggle').click()

def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

def shot(page, filename, full=True):
    page.screenshot(path=str(OUTPUT / filename), full_page=full)

def fill_group(page):
    for k,v in {'firstName':'Responsable','lastName':'De ejemplo','email':'demo@example.com','phone':'3000000000'}.items():
        page.locator('#r-'+k).fill(v)
    for _ in range(3): page.locator('[data-guests="1"]').click()

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
    browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    page = new_page(browser)
    check('Four booking steps', page.locator('.step-button').count()==4)
    check('45 map markers', page.locator('.map-marker').count()==45)
    check('45 alternative table buttons', page.locator('#table-grid button').count()==45)
    check('Preview visibly identified', 'VISTA PREVIA' in page.locator('#mode-banner').inner_text())
    page.locator('#next').click()
    check('Cannot advance without a table', page.locator('#global-error').is_visible())
    page.locator('[data-action="zoom"]').click()
    check('Map enlargement opens', page.locator('#map-dialog').evaluate('(e)=>e.open'))
    page.locator('#large-map [data-table="12"]').click()
    check('Map selection closes enlargement', not page.locator('#map-dialog').evaluate('(e)=>e.open'))
    check('Chosen table reflected in ticket', page.locator('#summary-table').inner_text()=='Mesa 12')
    page.locator('[data-zone="Lobby"]').click()
    check('12 Lobby tables in alternative list', page.locator('#table-grid button').count()==12)
    page.locator('[data-zone="all"]').click()
    page.evaluate('scrollTo(0,0)'); shot(page, 'formulario-claro.png')
    dark(page);check('Dark mode can be activated',page.locator('html').get_attribute('data-theme')=='dark')
    check('Appearance button accessible state',page.locator('.theme-toggle').get_attribute('aria-label')=='Activar modo claro')
    page.evaluate('scrollTo(0,0)');shot(page,'formulario-oscuro.png')
    light(page);page.locator('#next').click()
    check('Group step opens',page.locator('#r-firstName').is_visible())
    page.locator('#next').click()
    check('Required fields marked',page.locator('[aria-invalid=true]').count()==4)
    fill_group(page)
    check('5 members plus 3 guests is 1680000', '1.680.000' in page.locator('#summary-total').inner_text())
    page.locator('[data-quantity="10"]').click()
    check('7 members plus 3 guests is 2040000','2.040.000' in page.locator('#summary-total').inner_text())
    check('Quantity change preserves responsible',page.locator('#r-email').input_value()=='demo@example.com')
    page.locator('[data-quantity="8"]').click()
    dark(page)
    check('Theme preserves entered values',page.locator('#r-email').input_value()=='demo@example.com')
    light(page)
    page.locator('#next').click();page.locator('#previous').click()
    page.locator('#booking').screenshot(path=str(OUTPUT/'grupo-escritorio.png'))
    page.set_viewport_size({'width':390,'height':844});page.locator('#booking').scroll_into_view_if_needed()
    page.evaluate('scrollTo(0,document.querySelector("#booking").offsetTop-15)')
    shot(page,'grupo-movil.png',False)
    page.locator('#booking').screenshot(path=str(OUTPUT/'grupo-movil-completo.png'))
    check('Mobile summary is visible',page.locator('.mobile-total').is_visible())
    page.set_viewport_size({'width':1440,'height':1050})
    page.locator('#next').click()
    check('All 8 attendees are present',page.locator('.attendee').count()==8)
    check('Responsible is prefilled',page.locator('#m-0-firstName').input_value()=='Responsable')
    page.locator('#next').click()
    check('Cannot advance without attendees',page.locator('[aria-invalid=true]').count()>0)
    for i in range(5):
        page.locator(f'#person-m-{i}').evaluate('(e)=>e.open=true')
        if i:
            page.locator(f'#m-{i}-firstName').fill(f'Socio de ejemplo {i}')
            page.locator(f'#m-{i}-lastName').fill('Grupo de prueba')
        page.locator(f'#m-{i}-action').fill('DEMO-001')
    for i in range(3):
        page.locator(f'#person-g-{i}').evaluate('(e)=>e.open=true')
        for k,v in {'firstName':f'Invitado {i+1}','lastName':'De ejemplo','document':str(900000000+i),'email':f'invitado{i+1}@example.com','phone':'3000000000'}.items():
            page.locator(f'#g-{i}-{k}').fill(v)
    check('Attendee progress reaches 8 of 8',page.locator('#attendees-complete').inner_text()=='8')
    page.locator('#g-1-document').fill('900000000');page.locator('#next').click()
    check('Duplicate guest document rejected','repetido' in page.locator('#global-error').inner_text())
    page.locator('#g-1-document').fill('900000001')
    page.locator('#next').click();page.locator('[data-edit="2"]').click()
    # Keep first card open in visual reference, all other cards collapsed.
    page.locator('.attendee').evaluate_all('(es)=>es.forEach((e,i)=>e.open=i===0)')
    page.locator('#booking').screenshot(path=str(OUTPUT/'asistentes-escritorio.png'))
    page.locator('#next').click()
    check('Review contains 8 attendees',page.locator('.review-table tr').count()==8)
    page.locator('[data-edit="1"]').click()
    page.locator('[data-quantity="9"]').click();page.locator('[data-quantity="8"]').click();page.locator('#next').click()
    check('Attendee data survives back and quantity change',page.locator('#g-2-email').input_value()=='invitado3@example.com')
    page.locator('#next').click();page.locator('#next').click()
    check('Terms checkbox required',page.locator('#global-error').is_visible())
    page.locator('#accepted-terms').check();page.locator('#next').click()
    check('Preview dialog opens',page.locator('#notice-dialog').evaluate('(e)=>e.open'))
    check('Preview never confirms a real reservation','No se ha reservado' in page.locator('#notice-body').inner_text())
    page.locator('#notice-dialog [data-close]').first.click()
    check('All core UI interactions have no script errors', not errors)

    # Layout checks for all steps in both palettes. Internal map/dialog scroll is intentional.
    for width in [320,360,390,620,768,900,1024,1440,1920]:
        page.set_viewport_size({'width':width,'height':900})
        for theme in ['light','dark']:
            dark(page) if theme=='dark' else light(page)
            check(f'Review layout {width}px {theme}',no_overflow(page))
    page.close()
    # Table and group layouts at all breakpoints.
    for width in [320,360,390,620,768,900,1024,1440,1920]:
        pg=new_page(browser,width=width,height=900)
        for theme in ['light','dark']:
            dark(pg) if theme=='dark' else light(pg)
            check(f'Table layout {width}px {theme}',no_overflow(pg))
        pg.locator('#table-grid [data-table="12"]').click();pg.locator('#next').click()
        for theme in ['light','dark']:
            dark(pg) if theme=='dark' else light(pg)
            check(f'Group layout {width}px {theme}',no_overflow(pg))
        pg.close()

    admin=new_page(browser,admin=True)
    admin.locator('#demo-button').click()
    check('Admin demo identified as fictitious','ficticios' in admin.locator('#admin-banner').inner_text())
    check('4 KPI cards',admin.locator('.kpi').count()==4)
    shot(admin,'admin-claro.png');dark(admin);shot(admin,'admin-oscuro.png');light(admin)
    admin.locator('[data-tab="reservations"]').first.click()
    check('12 sample reservations',admin.locator('#reservation-rows tr').count()==12)
    admin.locator('#reservation-search').fill('DEMO-001')
    check('Reservation search works',admin.locator('#reservation-rows tr').count()==1)
    admin.locator('[data-detail="DEMO-001"]').click()
    check('Admin detail is visibly fictitious','ficticio' in admin.locator('#admin-dialog-body').inner_text())
    admin.locator('#close-detail').click();admin.locator('#reservation-search').fill('')
    admin.locator('[data-tab="tables"]').first.click()
    check('Admin 45 table controls',admin.locator('[data-table-detail]').count()==45)
    admin.locator('[data-table-detail="12"]').click()
    check('Admin table detail opens',admin.locator('#admin-dialog').evaluate('(e)=>e.open'))
    admin.locator('#close-detail').click()
    admin.locator('[data-tab="tests"]').first.click()
    check('4 test amounts preserved',admin.locator('[data-test]').count()==4)
    admin.locator('[data-test="T1000"]').click()
    check('Test selector still points to correct case','T1000' in admin.locator('#admin-content a.button').get_attribute('href'))
    admin.locator('[data-tab="history"]').first.click()
    check('History demo does not expose private data','no consulta' in admin.locator('#admin-content').inner_text())
    for width in [320,390,768,1024,1440]:
        admin.set_viewport_size({'width':width,'height':900})
        for tab in ['dashboard','reservations','tables','tests','history']:
            admin.locator(f'[data-tab="{tab}"]').first.click()
            for theme in ['light','dark']:
                dark(admin) if theme=='dark' else light(admin)
                check(f'Admin {tab} layout {width}px {theme}',no_overflow(admin))
    admin.set_viewport_size({'width':390,'height':844});light(admin);admin.locator('[data-tab="dashboard"]').first.click();admin.evaluate('scrollTo(0,0)');shot(admin,'admin-movil.png',False)
    admin.locator('#logout').click()
    check('Admin logout returns to access screen',admin.locator('#login-form').is_visible())
    check('No external HTTP calls in visual previews',not requests)
    check('No JavaScript errors in tested views',not errors)
    browser.close()
result={'scope':'In-memory Chromium previews. No Supabase/ePayco operations. No HTTP deployment validation.', 'checks':checks,'total':len(checks),'passed':sum(c['passed'] for c in checks),'errors':errors,'external_requests':requests}
(ROOT/'tests/ui-visual-v2.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'checks':result['total'],'passed':result['passed'],'errors':errors,'external_requests':requests}))
