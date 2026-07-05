import os
from app.detectors import Finding
from app.advisor import draft_advisory

def test_grok():
    print("Testing Grok API integration...")
    finding = Finding(
        kind="flaky_detection",
        severity="warning",
        queue_id="q_test",
        queue_name="test_queue",
        headline="Jobs on test_queue are flaking",
        evidence={"flaky": 5, "succeeded": 100}
    )
    
    try:
        draft = draft_advisory(finding)
        print("Success! Received draft:")
        print(f"Title: {draft.title}")
        print(f"Summary: {draft.summary}")
        print(f"Recommendation: {draft.recommendation}")
        print(f"Confidence: {draft.confidence}")
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    test_grok()
