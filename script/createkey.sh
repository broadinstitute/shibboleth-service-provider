set +x

head -c 12 /dev/urandom | base64 > .authkey
