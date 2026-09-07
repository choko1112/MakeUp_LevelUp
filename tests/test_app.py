from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_dashboard_is_available() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "StepLog" in response.text
    assert "今日のフォーカス" in response.text


def test_health_check() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
