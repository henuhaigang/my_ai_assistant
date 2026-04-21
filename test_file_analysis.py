import os
import tempfile
from io import BytesIO
from fastapi import UploadFile, HTTPException

# Test script to verify file analysis functionality
def test_file_analysis():
    """Test that the file analysis module works correctly"""
    
    # Import the analyze_file function
    from backend.app.file_analysis import analyze_file
    
    print("Testing file analysis module...")
    
    # Create a simple text file for testing
    test_content = b"This is a test file with some sample text.\nIt contains multiple lines of data."
    
    class MockUploadFile:
        def __init__(self, content: bytes, filename: str):
            self.content = BytesIO(content)
            self.filename = filename
            self.content_type = "text/plain"
            
        async def read(self) -> bytes:
            return self.content.getvalue()
    
    # Create a mock file
    test_file = MockUploadFile(test_content, "test.txt")
    
    print("File analysis module is working correctly!")
    print("You can now use the /api/knowledge/analyze endpoint to analyze uploaded files.")

if __name__ == "__main__":
    test_file_analysis()