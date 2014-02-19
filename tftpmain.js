#!/usr/bin/env node
/* vim: set ts=8 sts=8 sw=8 noet: */

var mod_tftp = require('tftp');
var mod_fs = require('fs');
var mod_path = require('path');

var TFTP;

/*
 * This is where we will get the platforms, overlay files, grub, etc:
 */
var ROOT = mod_path.join(__dirname, 'data');

function
log(msg)
{
	var dts = (new Date()).toLocaleTimeString();
	console.error('[' + dts + '] ' + msg);
}

function
walk_overlay_dir(root, dir)
{
	var out = [];
	var ents = mod_fs.readdirSync(mod_path.join(root, dir));
	for (var i = 0; i < ents.length; i++) {
		var ent = ents[i];
		var st = mod_fs.statSync(mod_path.join(root, dir,
		    ent));
		if (st.isFile()) {
			out.push(mod_path.join(dir, ent));
		} else if (st.isDirectory()) {
			out = out.concat(walk_overlay_dir(root,
			    mod_path.join(dir, ent)));
		}
	}
	return (out);
}

function
build_menu_lst()
{
	var out = [];

	var plats = [];
	var ents = mod_fs.readdirSync(ROOT);
	for (var i = 0; i < ents.length; i++) {
		var m = ents[i].match(/^platform-(.*)$/);
		if (m) {
			plats.push(m[1]);
		}
	}
	plats.sort().reverse();

	var overlays = walk_overlay_dir(mod_path.join(ROOT, 'overlay'), '');

	/*
	 * Hash of the password 'root':
	 */
	var root_shadow = '$5$hEQ0l8d5$s0Jwt.oif76hVoQpzsgH2XVKhS' +
	    '8uCXnMlQhXltYgvaB';

	var emit_plat = function (name, extra_string, opts) {
		out.push('title SmartOS (' + name + ') ' + extra_string);
		/*
		 * Add the Kernel for this platform:
		 */
		out.push('    kernel$ /os/' + name +
		    '/platform/i86pc/kernel/amd64/unix' +
		    ' -B console=${os_console},' +
		    '${os_console}-mode="115200,8,n,1,-",' +
		    opts.join(','));
		/*
		 * Add the Boot RAM Disk:
		 */
		out.push('    module$ /os/' + name +
		    '/platform/i86pc/amd64/boot_archive' +
		    ' type=rootfs name=ramdisk');
		out.push('    module$ /os/' + name +
		    '/platform/i86pc/amd64/boot_archive.hash' +
		    ' type=hash name=ramdisk');
		/*
		 * Add each of the overlay files:
		 */
		for (var j = 0; j < overlays.length; j++) {
			out.push('    module$ /overlay/' + overlays[j] +
			    ' type=file name=' + overlays[j]);
		}
		out.push('');
	};

	out.push('default 0');
	out.push('timeout 15');
	out.push('serial --speed=115200 --unit=1 --word=8 --parity=no ' +
	    '--stop=1');
	out.push('terminal composite');
	out.push('variable os_console vga');
	out.push('');

	for (var i = 0; i < plats.length; i++) {
		emit_plat(plats[i], '', [
			'smartos=true',
			'root_shadow=' + root_shadow
		]);
		emit_plat(plats[i], 'noinstall', [
			'noimport=true',
			'root_shadow=' + root_shadow
		]);
	}

	return (out.join('\n') + '\n\n');
}

function
make_path(path)
{
	return (mod_path.join(ROOT, path));
}

function
file_size(path)
{
	try {
		var st = mod_fs.statSync(path);
		return (st.size);
	} catch (ex) {
		log('ERROR: file_size: ' + ex.stack);
		return (false);
	}
}

var PLATFILE_RE = new RegExp('^/?os/([^/]+)/platform/(.*)$');
var OVERLAY_RE = new RegExp('^/?overlay/(.*)$');

(function
main(argv)
{
	log('smartos-pxe starting up');

	TFTP = mod_tftp.createServer({
		host: '0.0.0.0',
		/*port: 69,*/
		denyPUT: true
	}, function (req, res) {
		log(req.method + ' ' + req.file + ' (' +
		    req.stats.remoteAddress + ')');

		req.on('error', function (err) {
			//log('ERROR: aborted req: ' + err.message);
		});

		var m;
		if (req.file === 'bootfile') {
			var path = make_path('grub/pxegrub');
			var size = file_size(path);
			res.setSize(size);
			mod_fs.createReadStream(path).pipe(res);
		} else if (req.file.match(/^menu.lst.*/)) {
			var buf = new Buffer(build_menu_lst());
			res.setSize(buf.length);
			res.write(buf);
			res.end();
		} else if (m = OVERLAY_RE.exec(req.file)) {
			var path = make_path('overlay/' + m[1]);
			var size = file_size(path);
			res.setSize(size);
			mod_fs.createReadStream(path).pipe(res);
			return;
		} else if (m = PLATFILE_RE.exec(req.file)) {
			var path = make_path('platform-' + m[1] + '/' +
			    m[2]);
			var size = file_size(path);
			res.setSize(size);
			mod_fs.createReadStream(path).pipe(res);
			return;
		} else {
			log('WARN: invalid file: ' + req.file);
			req.abort();
			return;
		}
	});

	TFTP.listen();

})(process.argv.slice(2));
