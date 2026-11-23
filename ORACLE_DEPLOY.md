# Deploy MiniOS on Oracle Cloud Always Free

## 1. Create an eligible VM

In Oracle Cloud, create a VM using an **Always Free eligible** shape (for example, Ampere A1 Flex where available) and Ubuntu 24.04 ARM64. Select only resources marked Always Free eligible and confirm the estimated cost before creating the VM. Save the public IPv4 address and your SSH private key.

## 2. Allow web traffic

In the VM's VCN security list or Network Security Group, add an ingress rule for TCP port **80** from `0.0.0.0/0`. Keep SSH (TCP 22) restricted to your own IP address.

## 3. Install Docker and deploy

Connect to the VM over SSH, then run:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
git clone https://github.com/sommayadeep/MiniOS.git
cd MiniOS
sudo docker compose up -d --build
```

Open `http://YOUR_VM_PUBLIC_IP/` in a browser. Docker Compose restarts the app after VM reboots. To update it after a GitHub push:

```bash
cd ~/MiniOS
git pull
sudo docker compose up -d --build
```

This exposes HTTP on port 80. For HTTPS and a custom domain, configure a reverse proxy and DNS after the basic deployment works.
