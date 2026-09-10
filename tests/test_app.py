from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_dashboard_is_available() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "MakeUpLevelUp" in response.text
    assert "今日のフォーカス" in response.text


def test_health_check() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_calendar_page_and_navigation() -> None:
    dashboard = client.get("/")
    assert 'href="/calendar"' in dashboard.text
    response = client.get("/calendar")
    assert response.status_code == 200
    assert 'id="calendar-days"' in response.text
    assert 'id="day-journal"' in response.text
    assert 'aria-current="page"' in response.text
    for asset in ("js/storage.js", "js/calendar.js", "css/calendar.css"):
        assert client.get(f"/static/{asset}").status_code == 200
