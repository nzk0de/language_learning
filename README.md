docker run --rm -v language_app_esdata:/esdata -v $(pwd):/backup busybox \
  tar czf /backup/esdata_backup.tar.gz -C /esdata .

docker volume create local_esdata

# unpack backup into the new volume
docker run --rm \
  -v local_esdata:/esdata \
  -v $(pwd):/backup \
  busybox \
  tar xzf /backup/esdata_backup.tar.gz -C /esdata


mypy app --explicit-package-bases

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload