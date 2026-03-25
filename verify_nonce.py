# Test 1: userId 8900325899861668715
att1 = '{"userId":"8900325899861668715", "nonce":"27dcfc49-fb23-47a1-8984-19c822638e8c", "versionNumber":"311200000", "osVersionNumber":"ASUS_Z01QD/9.", "osPlatform":"TwitterAndroid", "deviceModel":"ASUS_Z01QD", "clientIdentifier":"847bb0c0-0189-4c95-973b-09a43c5a7447"}'
r1 = base64.b64encode(hashlib.sha256(att1.encode()).digest()).decode()
e1 = "THISa5QW+6N2xxsW/O7/zGzYKxGYIIoSdzuKqOJi6Xs="
print(f"Test 1: {r1 == e1}  computed={r1}  expected={e1}")

# Test 2: userId 1541722344259035136
att2 = '{"userId":"1541722344259035136", "nonce":"5be467ea-26df-48f4-af5f-a4ec5aa42f22", "versionNumber":"311200000", "osVersionNumber":"ASUS_Z01QD/9.", "osPlatform":"TwitterAndroid", "deviceModel":"ASUS_Z01QD", "clientIdentifier":"847bb0c0-0189-4c95-973b-09a43c5a7447"}'
r2 = base64.b64encode(hashlib.sha256(att2.encode()).digest()).decode()
e2 = "hdi+t3GpVRSTR4iVBqsEXBADLvbFfuYK4GPU4hWguZ8="
print(f"Test 2: {r2 == e2}  computed={r2}  expected={e2}")
