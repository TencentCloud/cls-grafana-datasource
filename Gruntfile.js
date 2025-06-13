module.exports = function (grunt) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-ts');

  grunt.initConfig({
    clean: ['dist'],

    copy: {
      src_to_dist: {
        cwd: 'src',
        expand: true,
        src: ['**/*', '!**/*.js', '!**/*.ts'],
        dest: 'dist',
      },
      pluginDef: {
        expand: true,
        src: ['README.md'],
        dest: 'dist',
      },
    },

    watch: {
      rebuild_all: {
        files: ['src/**/*'],
        tasks: ['default'],
        options: { spawn: false },
      },
    },

    babel: {
      options: {
        sourceMap: true,
        presets: ['es2015'],
      },
      dist: {
        options: {
          plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of'],
        },
        files: [
          {
            cwd: 'dist',
            expand: true,
            src: ['**/*.js'],
            dest: 'dist',
            ext: '.js',
          },
        ],
      },
    },
    ts: {
      default: {
        outDir: 'dist',
        tsconfig: './tsconfig.json',
      },
    },
  });

  grunt.registerTask('dev', ['clean', 'copy:src_to_dist', 'copy:pluginDef', 'ts', 'babel']);
  grunt.registerTask('default', ['clean', 'copy:src_to_dist', 'copy:pluginDef', 'ts', 'babel']);
};
