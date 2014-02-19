# smartos-pxe

This is a minimal TFTP server to make booting a SmartOS VM under VMware
Fusion somewhat easier.

## Configuring VMware Fusion

These instructions apply to VMware Fusion _5.X_, and might not be
applicable to earlier versions.

### DHCP

First up, you need to find the `dhcpd.conf` file for the VMware `dhcpd`.
The interface you probably want is `vmnet8`, the Shared/NAT Interface.
It's likely under `/Library/Preferences`, e.g.

```
# find /Library/Preferences -name dhcpd.conf
/Library/Preferences/VMware Fusion/vmnet8/dhcpd.conf
```

Open up that file, and find the `subnet` block.  You want to add the
`next-server` (TFTP Server IP) and `filename` directives to that subnet.
For example:

```diff
--- /tmp/orig.conf  2014-02-18 17:14:43.000000000 -0800
+++ /Library/Preferences/VMware Fusion/vmnet8/dhcpd.conf  2014-02-18
16:25:45.000000000 -0800
@@ -25,19 +25,22 @@
 
 subnet 10.88.88.0 netmask 255.255.255.0 {
  range 10.88.88.128 10.88.88.254;
  option broadcast-address 10.88.88.255;
  option domain-name-servers 10.88.88.2;
  option domain-name localdomain;
  default-lease-time 1800;                # default is 30 minutes
  max-lease-time 7200;                    # default is 2 hours
  option netbios-name-servers 10.88.88.2;
  option routers 10.88.88.2;
+
+ next-server 10.88.88.1;
+ filename "bootfile";
 }
```

The TFTP Server IP I have used, here, is the one that appears on my
`vmnet8` interface, as configured by VMware:

```
# ifconfig vmnet8
vmnet8: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu
1500
  ether 00:50:56:c0:00:08
  inet 10.88.88.1 netmask 0xffffff00 broadcast 10.88.88.255
```

Finally, bounce the VMware networking services.  For VMware Fusion 5,
you can do that thus:

```
# cd "/Applications/VMware Fusion.app/Contents/Library"
# ./services.sh --stop
# ./services.sh --start
```

Now, when you PXE boot your VMs, they will speak to the TFTP server
running on your Mac and ask for boot file(s).

### TFTP

Install Node.js, then check out this git repository on your Mac.
Install its dependencies.

```
# cd /var/tmp
# git clone git://github.com/jclulow/smartos-pxe.git
...
# cd smartos-pxe
# npm install
...
```

Start up the server:

```
# ./run
[17:22:33] smartos-pxe starting up
```

Grab a platform tarball from [smartos.org][2] (e.g.
`platform-20140207T053435Z.tgz`) and extract it into the `data/` sub
directory of `smartos-pxe`:

```
# cd data
# tar xvfz /tmp/platform-20140207T053435Z.tgz
platform-20140207T053435Z/i86pc/amd64/boot_archive
platform-20140207T053435Z/i86pc/amd64/...
```

### Create A Virtual Machine

Create a new Virtual Machine with an appropriate OS type -- e.g. _Solaris
11 64-bit_.  Configure the Network Adapter to be _Shared/NAT_, and to
boot from the Network rather than the disk.

When you boot the machine, you should see activity on the TFTP console:

```
[17:22:33] smartos-pxe starting up
[17:22:39] GET bootfile (10.88.88.128)
[17:22:39] GET bootfile (10.88.88.128)
[17:22:39] GET menu.lst.010050562E349F (10.88.88.128)
[17:22:39] GET menu.lst.010050562E349F (10.88.88.128)
[17:22:39] GET menu.lst.010050562E349F (10.88.88.128)
[17:22:39] GET menu.lst.010050562E349F (10.88.88.128)
[17:22:53] GET /os/20140207/platform/i86pc/kernel/amd64/unix (10.88.88.128)
[17:22:53] GET /os/20140207/platform/i86pc/kernel/amd64/unix (10.88.88.128)
[17:22:54] GET /os/20140207/platform/i86pc/amd64/boot_archive (10.88.88.128)
[17:22:54] GET /os/20140207/platform/i86pc/amd64/boot_archive (10.88.88.128)
...
```

The machine should boot to the Grub prompt, allowing you to select a
SmartOS platform from those you have extracted.

### Add Overlay Files

If you want to use [Anonymous DTrace][1], you can do so with relative
ease.  Simply create the `kernel/drv/dtrace.conf` and `etc/system` files
as described in [Keith's blog post][1], but put those under
`data/overlay` in the `smartos-pxe` directory.  For example:

```
# find data -type f
data/grub/pxegrub
data/overlay/etc/system
data/overlay/kernel/drv/dtrace.conf
...
data/platform-20140207/i86pc/amd64/boot_archive
data/platform-20140207/i86pc/amd64/boot_archive.gitstatus
data/platform-20140207/i86pc/amd64/boot_archive.hash
data/platform-20140207/i86pc/amd64/boot_archive.manifest
data/platform-20140207/i86pc/kernel/amd64/unix
data/platform-20140207/root.password
...
```

Next time you boot, the software will put the overlay directives into
the grub configuration automatically based on the contents of the
`overlay/` directory and the operating system will load them.


[1]: http://dtrace.org/blogs/wesolows/2013/12/28/anonymous-tracing-on-smartos/
[2]: http://smartos.org
