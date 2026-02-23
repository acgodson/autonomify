#!/usr/bin/env python3
import socket
import json
import sys

VSOCK_PORT = 5000
NODE_HOST = '127.0.0.1'
NODE_PORT = 5001

class VsockBridge:
    def __init__(self):
        self.vsock_sock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
        self.vsock_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    def start(self):
        self.vsock_sock.bind((socket.VMADDR_CID_ANY, VSOCK_PORT))
        self.vsock_sock.listen(5)
        print(f'Python vsock bridge listening on vsock:{VSOCK_PORT} -> localhost:{NODE_PORT}')

        while True:
            try:
                client_sock, addr = self.vsock_sock.accept()
                print(f'Vsock connection from CID {addr[0]}')
                self.handle_client(client_sock)
            except Exception as e:
                print(f'Error accepting connection: {e}')

    def handle_client(self, client_sock):
        try:
            data = b''
            while True:
                chunk = client_sock.recv(4096)
                if not chunk:
                    break
                data += chunk
                if b'\n' in chunk:
                    break

            if not data:
                client_sock.close()
                return

            node_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            node_sock.connect((NODE_HOST, NODE_PORT))
            node_sock.sendall(data)

            response = b''
            while True:
                chunk = node_sock.recv(4096)
                if not chunk:
                    break
                response += chunk
                if b'\n' in chunk:
                    break

            node_sock.close()
            client_sock.sendall(response)
            client_sock.close()

        except Exception as e:
            print(f'Error handling client: {e}')
            client_sock.close()

if __name__ == '__main__':
    bridge = VsockBridge()
    bridge.start()
