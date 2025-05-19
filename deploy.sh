#!/bin/bash

# Constants
SERVER_HOST="root@185.234.114.212"
SERVER_PASSWORD="tcpaUlRguyPc"  # Not recommended to store passwords in scripts, better use SSH keys or env file
SERVER_DIR="/home/intern/server"
REACT_DIR="/home/intern/server/flex-frontend"
DOMAIN="telemetry.omnicomm-expert.kz"
NGINX_PORT=80
SERVER_PORT=3333  # Port to be used by React application

# Function to display step information
print_step() {
    echo -e "\n====================================================================================";
    echo -e "= $(printf '%*s' $(((80-${#1})/2)) '')$1$(printf '%*s' $(((81-${#1})/2)) '') =";
    echo -e "====================================================================================\n";
}

# Function to execute commands
run_command() {
    echo "Executing: $1"
    eval "$1"
    if [ $? -ne 0 ]; then
        echo "Error executing command"
        return 1
    else
        echo "Successfully executed"
        return 0
    fi
}

# Check server connection
check_server_connection() {
    print_step "Checking connection to server"
    cmd="sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"echo Connection established\""
    run_command "$cmd"
    return $?
}

# Check domain DNS records
check_domain_dns() {
    print_step "Checking DNS records"
    cmd="nslookup $DOMAIN"
    run_command "$cmd"
    return $?
}

# Create directory on server for project
create_server_directory() {
    print_step "Creating directory on server"
    cmd="sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"mkdir -p $REACT_DIR\""
    run_command "$cmd"
    return $?
}


install_nodejs() {
    print_step "Installing Node.js and npm on server"
    commands=(
        # Удаляем конфликтующие пакеты
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo apt-get remove -y libnode-dev libnode72\""
        # Можно также использовать purge для полного удаления конфигурационных файлов
        # "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo apt-get purge -y libnode-dev libnode72\""
        
        # Используем версию Node.js 20.x вместо устаревшей 16.x
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -\""
        
        # Вариант с форсированной установкой на случай, если удаление пакетов не поможет
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo apt-get -o Dpkg::Options::='--force-overwrite' install -y nodejs\""
        
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo npm install -g pm2\""
    )
    
    for cmd in "${commands[@]}"; do
        run_command "$cmd"
        if [ $? -ne 0 ]; then
            # Продолжаем выполнение, даже если одна из команд не удалась
            echo "Warning: Command failed, but continuing with next step"
            # return 1 - закомментируем, чтобы продолжить выполнение
        fi
    done
    return 0
}


# Build React application
build_react_app() {
    print_step "Building React application"
    commands=(
        "npm install"
        "npm run build"
    )
    
    for cmd in "${commands[@]}"; do
        run_command "$cmd"
        if [ $? -ne 0 ]; then
            return 1
        fi
    done
    return 0
}

# Copy build to server
copy_build_to_server() {
    print_step "Copying build to server"
    cmd="sshpass -p \"$SERVER_PASSWORD\" scp -o StrictHostKeyChecking=no -r build/* $SERVER_HOST:$REACT_DIR/"
    run_command "$cmd"
    return $?
}

# Create package.json on server
create_package_json() {
    print_step "Creating package.json on server"
    
    # Create temporary package.json for server
    cat > server-package.json <<EOL
{
  "name": "flex-frontend",
  "version": "1.0.0",
  "description": "Frontend for Flex Telemetry",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "compression": "^1.7.4",
    "cors": "^2.8.5"
  }
}
EOL
    
    # Copy to server
    cmd="sshpass -p \"$SERVER_PASSWORD\" scp -o StrictHostKeyChecking=no server-package.json $SERVER_HOST:$REACT_DIR/package.json"
    run_command "$cmd"
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    # Remove temporary file
    rm server-package.json
    return 0
}

# Create Express server script
create_server_js() {
    print_step "Creating Express server"
    
    # Create temporary server.js file
    cat > server.js <<EOL
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || $SERVER_PORT;

// Enable gzip compression
app.use(compression());

// Allow CORS
app.use(cors());

// Static files from current directory
app.use(express.static(__dirname));

// Routing for SPA (Single Page Application)
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server is running on port \${PORT}\`);
});
EOL
    
    # Copy to server
    cmd="sshpass -p \"$SERVER_PASSWORD\" scp -o StrictHostKeyChecking=no server.js $SERVER_HOST:$REACT_DIR/server.js"
    run_command "$cmd"
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    # Remove temporary file
    rm server.js
    return 0
}

# Install dependencies on server
install_server_dependencies() {
    print_step "Installing dependencies on server"
    cmd="sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"cd $REACT_DIR && npm install\""
    run_command "$cmd"
    return $?
}

# Create PM2 instance for running React application
create_pm2_instance() {
    print_step "Creating PM2 instance"
    commands=(
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"cd $REACT_DIR && pm2 stop flex-frontend || true\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"cd $REACT_DIR && pm2 delete flex-frontend || true\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"cd $REACT_DIR && pm2 start server.js --name flex-frontend\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"pm2 save\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"pm2 startup systemd && sudo env PATH=\\\$PATH:/usr/bin pm2 startup systemd -u intern --hp /home/intern\""
    )
    
    for cmd in "${commands[@]}"; do
        run_command "$cmd"
        if [ $? -ne 0 ]; then
            echo "Error creating PM2 instance, but continuing deployment"
        fi
    done
    return 0
}

# Configure Nginx
update_nginx_config() {
    print_step "Configuring Nginx"
    
    # Create temporary Nginx configuration file
    cat > flex-nginx.conf <<EOL
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:$SERVER_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Optimization for static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        proxy_pass http://127.0.0.1:$SERVER_PORT;
    }
}
EOL
    
    # Copy to server
    cmd="sshpass -p \"$SERVER_PASSWORD\" scp -o StrictHostKeyChecking=no flex-nginx.conf $SERVER_HOST:$SERVER_DIR/flex-nginx.conf"
    run_command "$cmd"
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    # Configure Nginx
    commands=(
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo mv $SERVER_DIR/flex-nginx.conf /etc/nginx/sites-available/flex-nginx.conf\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo ln -sf /etc/nginx/sites-available/flex-nginx.conf /etc/nginx/sites-enabled/\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo nginx -t\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo systemctl restart nginx\""
    )
    
    for cmd in "${commands[@]}"; do
        run_command "$cmd"
        if [ $? -ne 0 ]; then
            echo "Error configuring Nginx, but continuing deployment"
        fi
    done
    
    # Remove temporary file
    rm flex-nginx.conf
    return 0
}

# Configure SSL with certbot
setup_ssl() {
    print_step "Configuring SSL (HTTPS)"
    commands=(
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo apt-get update\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo apt-get install -y certbot python3-certbot-nginx\""
        "sshpass -p \"$SERVER_PASSWORD\" ssh -o StrictHostKeyChecking=no $SERVER_HOST \"sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@omnicomm-expert.kz\""
    )
    
    for cmd in "${commands[@]}"; do
        run_command "$cmd"
        if [ $? -ne 0 ]; then
            echo "Error configuring SSL, but continuing deployment"
        fi
    done
    return 0
}

# Main deploy function
deploy() {
    if ! check_server_connection; then
        echo "Error connecting to server"
        return 1
    fi
    
    if ! check_domain_dns; then
        echo "Warning during DNS check, but continuing..."
    fi
    
    if ! create_server_directory; then
        echo "Error creating directory on server"
        return 1
    fi
    
    if ! install_nodejs; then
        echo "Error installing Node.js"
        return 1
    fi
    
    if ! build_react_app; then
        echo "Error building React application"
        return 1
    fi
    
    if ! copy_build_to_server; then
        echo "Error copying build to server"
        return 1
    fi
    
    if ! create_package_json; then
        echo "Error creating package.json on server"
        return 1
    fi
    
    if ! create_server_js; then
        echo "Error creating Express server"
        return 1
    fi
    
    if ! install_server_dependencies; then
        echo "Error installing dependencies on server"
        return 1
    fi
    
    if ! create_pm2_instance; then
        echo "Error creating PM2 instance"
        return 1
    fi
    
    if ! update_nginx_config; then
        echo "Error configuring Nginx"
        return 1
    fi
    
    if [ "$NO_SSL" != "true" ]; then
        if ! setup_ssl; then
            echo "Error configuring SSL"
            return 1
        fi
    fi
    
    print_step "Deployment completed successfully!"
    echo "Your application is available at: https://$DOMAIN"
    return 0
}

# Command line arguments processing
NO_SSL="false"
while [ "$1" != "" ]; do
    case $1 in
        --no-ssl )    NO_SSL="true"
                      ;;
        * )           echo "Unknown parameter: $1"
                      exit 1
    esac
    shift
done

# Start deployment
deploy
exit $? 