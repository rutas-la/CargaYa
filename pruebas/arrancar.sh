#!/bin/bash
sudo service postgresql start >/dev/null 2>&1; sleep 2
cd /home/claude/v2test
pkill -f "postgrest pgrst.conf"; pkill -f fakesb.py
nohup /opt/pgrst/postgrest pgrst.conf > pgrst.log 2>&1 &
sleep 1
nohup python3 fakesb.py /home/claude/repo-cargaya 8780 > fakesb.log 2>&1 &
sleep 2
