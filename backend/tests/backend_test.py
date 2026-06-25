"""Effects Academy backend API tests"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://video-editor-vault.preview.emergentagent.com').rstrip('/')
PASSWORD = "EffectsAcademy2026Base44"
H_AUTH = {"X-Upload-Password": PASSWORD}

# Track created entities for cleanup
created = {"assets": [], "packs": [], "categories": []}


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    for aid in created["assets"]:
        requests.delete(f"{BASE_URL}/api/assets/{aid}", headers=H_AUTH)
    for pid in created["packs"]:
        requests.delete(f"{BASE_URL}/api/packs/{pid}", headers=H_AUTH)
    for cid in created["categories"]:
        requests.delete(f"{BASE_URL}/api/categories/{cid}", headers=H_AUTH)


# ---------- Health ----------
def test_root_ok():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_verify_password_correct():
    r = requests.post(f"{BASE_URL}/api/auth/verify-password", json={"password": PASSWORD})
    assert r.status_code == 200
    assert r.json() == {"valid": True}


def test_verify_password_wrong():
    r = requests.post(f"{BASE_URL}/api/auth/verify-password", json={"password": "wrong"})
    assert r.status_code == 200
    assert r.json() == {"valid": False}


# ---------- Assets list (initial) ----------
def test_assets_list_returns_array():
    r = requests.get(f"{BASE_URL}/api/assets")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Assets CRUD ----------
def test_create_asset_no_password_403():
    r = requests.post(f"{BASE_URL}/api/assets", json={"title": "x", "category": "Overlays"})
    assert r.status_code == 403


def test_create_asset_with_password_and_filter():
    payload = {"title": "TEST_Overlay1", "category": "Overlays", "external_url": "https://drive.google.com/test"}
    r = requests.post(f"{BASE_URL}/api/assets", json=payload, headers=H_AUTH)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "TEST_Overlay1"
    assert data["category"] == "Overlays"
    assert "id" in data
    created["assets"].append(data["id"])

    # filter by category
    r2 = requests.get(f"{BASE_URL}/api/assets", params={"category": "Overlays"})
    assert r2.status_code == 200
    ids = [a["id"] for a in r2.json()]
    assert data["id"] in ids


def test_patch_asset_requires_password():
    r = requests.post(f"{BASE_URL}/api/assets", json={"title": "TEST_Patch", "category": "Presets"}, headers=H_AUTH)
    aid = r.json()["id"]
    created["assets"].append(aid)

    # without password
    r_no = requests.patch(f"{BASE_URL}/api/assets/{aid}", json={"title": "TEST_Patched"})
    assert r_no.status_code == 403

    # with password
    r_ok = requests.patch(f"{BASE_URL}/api/assets/{aid}", json={"title": "TEST_Patched"}, headers=H_AUTH)
    assert r_ok.status_code == 200
    assert r_ok.json()["title"] == "TEST_Patched"


def test_download_increments_count():
    r = requests.post(f"{BASE_URL}/api/assets", json={"title": "TEST_DL", "category": "Audios"}, headers=H_AUTH)
    aid = r.json()["id"]
    created["assets"].append(aid)
    r1 = requests.post(f"{BASE_URL}/api/assets/{aid}/download")
    assert r1.status_code == 200
    assert r1.json()["download_count"] == 1
    r2 = requests.post(f"{BASE_URL}/api/assets/{aid}/download")
    assert r2.json()["download_count"] == 2


def test_delete_asset_requires_password():
    r = requests.post(f"{BASE_URL}/api/assets", json={"title": "TEST_Del", "category": "Audios"}, headers=H_AUTH)
    aid = r.json()["id"]
    # without
    assert requests.delete(f"{BASE_URL}/api/assets/{aid}").status_code == 403
    # with
    assert requests.delete(f"{BASE_URL}/api/assets/{aid}", headers=H_AUTH).status_code == 200
    # verify
    r3 = requests.get(f"{BASE_URL}/api/assets")
    assert aid not in [a["id"] for a in r3.json()]


# ---------- Packs ----------
def test_create_and_filter_packs():
    r_no = requests.post(f"{BASE_URL}/api/packs", json={"name": "x", "category": "Overlays"})
    assert r_no.status_code == 403
    r = requests.post(f"{BASE_URL}/api/packs", json={"name": "TEST_Pack", "category": "Overlays"}, headers=H_AUTH)
    assert r.status_code == 200
    pid = r.json()["id"]
    created["packs"].append(pid)
    r2 = requests.get(f"{BASE_URL}/api/packs", params={"category": "Overlays"})
    assert pid in [p["id"] for p in r2.json()]


# ---------- DMCA + Suggestions ----------
def test_dmca_and_suggestions_public():
    payload = {"full_name": "TEST User", "email": "test@example.com", "content_or_subject": "Test", "description": "desc"}
    r1 = requests.post(f"{BASE_URL}/api/dmca", json=payload)
    assert r1.status_code == 200
    assert r1.json()["kind"] == "dmca"
    r2 = requests.post(f"{BASE_URL}/api/suggestions", json=payload)
    assert r2.status_code == 200
    assert r2.json()["kind"] == "suggestion"


def test_submissions_requires_password():
    assert requests.get(f"{BASE_URL}/api/submissions").status_code == 403
    r = requests.get(f"{BASE_URL}/api/submissions", headers=H_AUTH)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Uploads ----------
def test_upload_file_and_serve():
    files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
    r_no = requests.post(f"{BASE_URL}/api/uploads", files=files)
    assert r_no.status_code == 403
    files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files, headers=H_AUTH)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/uploads/")
    # serve with download
    r2 = requests.get(f"{BASE_URL}{url}", params={"download": 1})
    assert r2.status_code == 200
    assert "attachment" in r2.headers.get("Content-Disposition", "")


# ---------- Categories ----------
def test_categories_crud():
    r_no = requests.post(f"{BASE_URL}/api/categories", json={"name": "x"})
    assert r_no.status_code == 403
    r = requests.post(f"{BASE_URL}/api/categories", json={"name": "TEST_Cat", "color": "#FF0000"}, headers=H_AUTH)
    assert r.status_code == 200
    cid = r.json()["id"]
    created["categories"].append(cid)
    r2 = requests.get(f"{BASE_URL}/api/categories")
    assert cid in [c["id"] for c in r2.json()]
