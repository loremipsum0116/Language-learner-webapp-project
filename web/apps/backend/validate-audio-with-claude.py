#!/usr/bin/env python3
"""
Audio validation script using Whisper for transcription and Claude for validation
"""

import os
import json
import whisper
import anthropic
from pathlib import Path
from typing import Dict, List, Tuple
import argparse
from tqdm import tqdm
import time

class AudioValidator:
    def __init__(self, claude_api_key: str):
        """Initialize the validator with Claude API"""
        self.whisper_model = whisper.load_model("base")
        self.claude = anthropic.Anthropic(api_key=claude_api_key)
        self.results = []
        
    def transcribe_audio(self, audio_path: str) -> str:
        """Transcribe audio file using Whisper"""
        try:
            result = self.whisper_model.transcribe(audio_path)
            return result["text"].strip()
        except Exception as e:
            return f"Error transcribing: {str(e)}"
    
    def validate_with_claude(self, word: str, transcription: str, audio_path: str) -> Dict:
        """Validate transcription using Claude API"""
        prompt = f"""
        You are validating an English pronunciation audio file.
        
        Expected word: "{word}"
        Transcribed audio: "{transcription}"
        
        Please analyze and provide:
        1. Match accuracy (0-100): How well does the transcription match the expected word?
        2. Is this audio file acceptable? (yes/no)
        3. Brief reason for your decision
        
        Respond in JSON format:
        {{
            "accuracy": <number>,
            "acceptable": <boolean>,
            "reason": "<brief explanation>",
            "severity": "good|minor_issue|major_issue|unusable"
        }}
        
        Consider:
        - Exact matches or very close pronunciations are acceptable
        - Minor variations in pronunciation are OK
        - Completely different words or gibberish are not acceptable
        - Background noise or poor quality that obscures the word is not acceptable
        """
        
        try:
            response = self.claude.messages.create(
                model="claude-3-haiku-20240307",  # Using Haiku for cost efficiency
                max_tokens=200,
                temperature=0,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse Claude's response
            content = response.content[0].text
            # Extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "accuracy": 0,
                    "acceptable": False,
                    "reason": "Failed to parse response",
                    "severity": "unusable"
                }
                
        except Exception as e:
            return {
                "accuracy": 0,
                "acceptable": False,
                "reason": f"API error: {str(e)}",
                "severity": "unusable"
            }
    
    def validate_file(self, audio_path: str, word: str) -> Dict:
        """Validate a single audio file"""
        # Transcribe audio
        transcription = self.transcribe_audio(audio_path)
        
        # Validate with Claude
        validation = self.validate_with_claude(word, transcription, audio_path)
        
        return {
            "file": audio_path,
            "word": word,
            "transcription": transcription,
            "validation": validation
        }
    
    def validate_directory(self, directory: str, limit: int = None) -> List[Dict]:
        """Validate all example.mp3 files in directory structure"""
        audio_files = []
        
        # Collect all example.mp3 files
        for root, dirs, files in os.walk(directory):
            if "example.mp3" in files:
                audio_path = os.path.join(root, "example.mp3")
                # Extract word from directory name
                word = os.path.basename(root)
                audio_files.append((audio_path, word))
        
        # Apply limit if specified
        if limit:
            audio_files = audio_files[:limit]
        
        print(f"Found {len(audio_files)} audio files to validate")
        
        # Process files with progress bar
        for audio_path, word in tqdm(audio_files, desc="Validating audio files"):
            result = self.validate_file(audio_path, word)
            self.results.append(result)
            
            # Rate limiting for API
            time.sleep(0.5)  # Adjust based on your API limits
        
        return self.results
    
    def generate_report(self, output_file: str = "audio_validation_report.json"):
        """Generate validation report"""
        # Separate files by severity
        report = {
            "total_files": len(self.results),
            "good": [],
            "minor_issues": [],
            "major_issues": [],
            "unusable": []
        }
        
        for result in self.results:
            severity = result["validation"].get("severity", "unusable")
            if severity == "good":
                report["good"].append(result)
            elif severity == "minor_issue":
                report["minor_issues"].append(result)
            elif severity == "major_issue":
                report["major_issues"].append(result)
            else:
                report["unusable"].append(result)
        
        # Add statistics
        report["statistics"] = {
            "good_count": len(report["good"]),
            "minor_issues_count": len(report["minor_issues"]),
            "major_issues_count": len(report["major_issues"]),
            "unusable_count": len(report["unusable"]),
            "acceptable_percentage": (len(report["good"]) + len(report["minor_issues"])) / len(self.results) * 100 if self.results else 0
        }
        
        # Save report
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Print summary
        print("\n" + "="*50)
        print("VALIDATION SUMMARY")
        print("="*50)
        print(f"Total files validated: {report['total_files']}")
        print(f"Good quality: {report['statistics']['good_count']}")
        print(f"Minor issues: {report['statistics']['minor_issues_count']}")
        print(f"Major issues: {report['statistics']['major_issues_count']}")
        print(f"Unusable: {report['statistics']['unusable_count']}")
        print(f"Acceptable rate: {report['statistics']['acceptable_percentage']:.1f}%")
        print(f"\nDetailed report saved to: {output_file}")
        
        # Print examples of problematic files
        if report["unusable"]:
            print("\n" + "="*50)
            print("SAMPLE UNUSABLE FILES (max 5)")
            print("="*50)
            for item in report["unusable"][:5]:
                print(f"\nFile: {item['file']}")
                print(f"Expected: {item['word']}")
                print(f"Got: {item['transcription']}")
                print(f"Reason: {item['validation']['reason']}")
        
        return report

def main():
    parser = argparse.ArgumentParser(description="Validate audio files using Whisper and Claude")
    parser.add_argument("--api-key", required=True, help="Claude API key")
    parser.add_argument("--directory", default=".", help="Directory to scan for audio files")
    parser.add_argument("--limit", type=int, help="Limit number of files to validate (for testing)")
    parser.add_argument("--output", default="audio_validation_report.json", help="Output report file")
    
    args = parser.parse_args()
    
    # Create validator
    validator = AudioValidator(args.api_key)
    
    # Validate files
    validator.validate_directory(args.directory, args.limit)
    
    # Generate report
    validator.generate_report(args.output)

if __name__ == "__main__":
    main()